import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Book, BookDocument, BookStatus } from './schemas/book.schema';
import { Borrowing, BorrowingDocument, BorrowingStatus } from './schemas/borrowing.schema';
import { CreateBookDto, UpdateBookDto } from './dto/create-book.dto';
import { BookQueryDto } from './dto/library-query.dto';

@Injectable()
export class LibraryBookService {
  private readonly logger = new Logger(LibraryBookService.name);

  constructor(
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
    @InjectModel(Borrowing.name) private borrowingModel: Model<BorrowingDocument>,
  ) {}

  async create(createBookDto: CreateBookDto, createdBy?: string): Promise<Book> {
    const book = new this.bookModel({
      ...createBookDto,
      availableQuantity: createBookDto.totalQuantity || 1,
      createdBy: createdBy ? new Types.ObjectId(createdBy) : undefined,
    });

    const savedBook = await book.save();
    this.logger.log(`Book created: ${savedBook._id} - ${savedBook.title}`);
    return savedBook;
  }

  async findAll(query: BookQueryDto, branchId?: string) {
    const {
      page = 1,
      limit = 20,
      search,
      categoryId,
      status,
      tag,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;

    const filter: any = {};

    // Branch filter
    const effectiveBranchId = query.branchId || branchId;
    if (effectiveBranchId) {
      filter.branch = new Types.ObjectId(effectiveBranchId);
    }

    // Category filter
    if (categoryId) {
      filter.category = new Types.ObjectId(categoryId);
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Tag filter
    if (tag) {
      filter.tags = tag;
    }

    // Search filter
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { author: { $regex: search, $options: 'i' } },
        { isbn: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const total = await this.bookModel.countDocuments(filter);
    const items = await this.bookModel
      .find(filter)
      .populate('category', 'name color code')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    };
  }

  async findById(id: string): Promise<Book | null> {
    const book = await this.bookModel
      .findById(id)
      .populate('branch', 'name')
      .populate('category', 'name color code')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();

    return book;
  }

  async findByIdWithBorrowings(id: string) {
    const book = await this.bookModel
      .findById(id)
      .populate('branch', 'name')
      .populate('category', 'name color code')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .lean()
      .exec();

    if (!book) {
      return null;
    }

    // Get recent borrowings for this book
    const recentBorrowings = await this.borrowingModel
      .find({ book: new Types.ObjectId(id) })
      .populate('member', 'firstName lastName email')
      .populate('issuedBy', 'firstName lastName')
      .populate('returnedTo', 'firstName lastName')
      .sort({ borrowDate: -1 })
      .limit(10)
      .exec();

    // Get current active borrowings count
    const activeBorrowingsCount = await this.borrowingModel.countDocuments({
      book: new Types.ObjectId(id),
      status: { $in: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] },
    });

    return {
      ...book,
      recentBorrowings,
      activeBorrowingsCount,
    };
  }

  async update(id: string, updateBookDto: UpdateBookDto, updatedBy?: string): Promise<Book> {
    const book = await this.bookModel.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    // Handle quantity changes
    if (updateBookDto.totalQuantity !== undefined) {
      const currentBorrowed = book.totalQuantity - book.availableQuantity;
      if (updateBookDto.totalQuantity < currentBorrowed) {
        throw new BadRequestException(
          `Cannot reduce total quantity below currently borrowed copies (${currentBorrowed})`,
        );
      }
      // Adjust available quantity proportionally
      updateBookDto.availableQuantity = updateBookDto.totalQuantity - currentBorrowed;
    }

    const updateData = {
      ...updateBookDto,
      updatedBy: updatedBy ? new Types.ObjectId(updatedBy) : undefined,
    };

    const updatedBook = await this.bookModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('category', 'name color code')
      .populate('createdBy', 'firstName lastName')
      .populate('updatedBy', 'firstName lastName')
      .exec();

    if (!updatedBook) {
      throw new NotFoundException(`Book with ID ${id} not found after update`);
    }

    this.logger.log(`Book updated: ${id}`);
    return updatedBook;
  }

  async remove(id: string): Promise<void> {
    const book = await this.bookModel.findById(id);
    if (!book) {
      throw new NotFoundException(`Book with ID ${id} not found`);
    }

    // Check for active borrowings
    const activeBorrowings = await this.borrowingModel.countDocuments({
      book: new Types.ObjectId(id),
      status: { $in: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] },
    });

    if (activeBorrowings > 0) {
      throw new BadRequestException(
        `Cannot delete book with ${activeBorrowings} active borrowing(s)`,
      );
    }

    await this.bookModel.findByIdAndDelete(id);
    this.logger.log(`Book deleted: ${id}`);
  }

  async updateAvailability(bookId: string, change: number): Promise<void> {
    const book = await this.bookModel.findById(bookId);
    if (!book) {
      throw new NotFoundException(`Book with ID ${bookId} not found`);
    }

    const newAvailable = book.availableQuantity + change;
    if (newAvailable < 0) {
      throw new BadRequestException('No copies available for borrowing');
    }
    if (newAvailable > book.totalQuantity) {
      throw new BadRequestException('Available quantity cannot exceed total quantity');
    }

    // Update status based on new availability
    let newStatus: BookStatus;
    if (newAvailable === 0) {
      newStatus = BookStatus.OUT_OF_STOCK;
    } else if (newAvailable <= Math.ceil(book.totalQuantity * 0.2)) {
      newStatus = BookStatus.LOW_STOCK;
    } else {
      newStatus = BookStatus.AVAILABLE;
    }

    await this.bookModel.findByIdAndUpdate(bookId, {
      $set: { availableQuantity: newAvailable, status: newStatus },
    });
  }

  async getBookStats(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);

    const [
      totalBooks,
      totalCopies,
      availableCopies,
      borrowedCopies,
      overdueCount,
      categoryBreakdown,
    ] = await Promise.all([
      this.bookModel.countDocuments({ branch: branchObjectId }),
      this.bookModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: null, total: { $sum: '$totalQuantity' } } },
      ]),
      this.bookModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: null, total: { $sum: '$availableQuantity' } } },
      ]),
      this.borrowingModel.countDocuments({
        branch: branchObjectId,
        status: { $in: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] },
      }),
      this.borrowingModel.countDocuments({
        branch: branchObjectId,
        status: BorrowingStatus.OVERDUE,
      }),
      this.bookModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        {
          $lookup: {
            from: 'bookcategories',
            localField: '_id',
            foreignField: '_id',
            as: 'categoryDetails',
          },
        },
        { $unwind: { path: '$categoryDetails', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            categoryId: '$_id',
            categoryName: { $ifNull: ['$categoryDetails.name', 'Uncategorized'] },
            count: 1,
          },
        },
      ]),
    ]);

    return {
      totalBooks,
      totalCopies: totalCopies[0]?.total || 0,
      availableCopies: availableCopies[0]?.total || 0,
      borrowedCopies,
      overdueCount,
      categoryBreakdown,
    };
  }
}
