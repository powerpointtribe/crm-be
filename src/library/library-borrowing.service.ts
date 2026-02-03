import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Borrowing, BorrowingDocument, BorrowingStatus } from './schemas/borrowing.schema';
import { Book, BookDocument } from './schemas/book.schema';
import { CreateBorrowingDto, ReturnBookDto, UpdateBorrowingDto } from './dto/create-borrowing.dto';
import { BorrowingQueryDto } from './dto/library-query.dto';
import { LibraryBookService } from './library-book.service';

@Injectable()
export class LibraryBorrowingService {
  private readonly logger = new Logger(LibraryBorrowingService.name);

  constructor(
    @InjectModel(Borrowing.name) private borrowingModel: Model<BorrowingDocument>,
    @InjectModel(Book.name) private bookModel: Model<BookDocument>,
    private libraryBookService: LibraryBookService,
  ) {}

  async create(
    createBorrowingDto: CreateBorrowingDto,
    issuedBy: string,
  ): Promise<Borrowing> {
    // Verify book exists and has available copies
    const book = await this.bookModel.findById(createBorrowingDto.book);
    if (!book) {
      throw new NotFoundException(`Book with ID ${createBorrowingDto.book} not found`);
    }

    if (book.availableQuantity <= 0) {
      throw new BadRequestException('No copies of this book are available for borrowing');
    }

    // Verify due date is in the future
    const dueDate = new Date(createBorrowingDto.dueDate);
    if (dueDate <= new Date()) {
      throw new BadRequestException('Due date must be in the future');
    }

    // Check if member already has this book borrowed
    const existingBorrowing = await this.borrowingModel.findOne({
      book: createBorrowingDto.book,
      member: createBorrowingDto.member,
      status: { $in: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] },
    });

    if (existingBorrowing) {
      throw new BadRequestException('Member already has this book borrowed');
    }

    // Create borrowing record
    const borrowing = new this.borrowingModel({
      ...createBorrowingDto,
      borrowDate: createBorrowingDto.borrowDate || new Date(),
      issuedBy: new Types.ObjectId(issuedBy),
      status: BorrowingStatus.BORROWED,
    });

    const savedBorrowing = await borrowing.save();

    // Update book availability
    await this.libraryBookService.updateAvailability(createBorrowingDto.book, -1);

    this.logger.log(`Book borrowed: ${savedBorrowing._id} - Book: ${book.title}`);

    const result = await this.findById(savedBorrowing._id.toString());
    if (!result) {
      throw new NotFoundException('Failed to retrieve created borrowing');
    }
    return result;
  }

  async findAll(query: BorrowingQueryDto, branchId?: string) {
    const {
      page = 1,
      limit = 20,
      search,
      memberId,
      bookId,
      status,
      isOverdue,
      sortBy = 'borrowDate',
      sortOrder = 'desc',
    } = query;

    const filter: any = {};

    // Branch filter
    const effectiveBranchId = query.branchId || branchId;
    if (effectiveBranchId) {
      filter.branch = new Types.ObjectId(effectiveBranchId);
    }

    // Member filter
    if (memberId) {
      filter.member = new Types.ObjectId(memberId);
    }

    // Book filter
    if (bookId) {
      filter.book = new Types.ObjectId(bookId);
    }

    // Status filter
    if (status) {
      filter.status = status;
    }

    // Overdue filter
    if (typeof isOverdue === 'boolean') {
      if (isOverdue) {
        filter.status = BorrowingStatus.OVERDUE;
      }
    }

    // Build aggregation pipeline for search (to search across populated fields)
    let items: any[];
    let total: number;

    if (search) {
      const pipeline: any[] = [
        { $match: filter },
        {
          $lookup: {
            from: 'books',
            localField: 'book',
            foreignField: '_id',
            as: 'bookDetails',
          },
        },
        { $unwind: '$bookDetails' },
        {
          $lookup: {
            from: 'members',
            localField: 'member',
            foreignField: '_id',
            as: 'memberDetails',
          },
        },
        { $unwind: '$memberDetails' },
        {
          $match: {
            $or: [
              { 'bookDetails.title': { $regex: search, $options: 'i' } },
              { 'memberDetails.firstName': { $regex: search, $options: 'i' } },
              { 'memberDetails.lastName': { $regex: search, $options: 'i' } },
              { 'memberDetails.email': { $regex: search, $options: 'i' } },
            ],
          },
        },
        { $sort: { [sortBy]: sortOrder === 'asc' ? 1 : -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
      ];

      const countPipeline = [...pipeline.slice(0, -3), { $count: 'total' }];

      items = await this.borrowingModel.aggregate(pipeline);
      const countResult = await this.borrowingModel.aggregate(countPipeline);
      total = countResult[0]?.total || 0;

      // Re-populate the items since we used aggregation
      items = await this.borrowingModel.populate(items, [
        { path: 'book', select: 'title author isbn coverImage' },
        { path: 'member', select: 'firstName lastName email phone' },
        { path: 'issuedBy', select: 'firstName lastName' },
        { path: 'returnedTo', select: 'firstName lastName' },
      ]);
    } else {
      total = await this.borrowingModel.countDocuments(filter);
      items = await this.borrowingModel
        .find(filter)
        .populate('book', 'title author isbn coverImage')
        .populate('member', 'firstName lastName email phone')
        .populate('issuedBy', 'firstName lastName')
        .populate('returnedTo', 'firstName lastName')
        .sort({ [sortBy]: sortOrder === 'asc' ? 1 : -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .exec();
    }

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

  async findById(id: string): Promise<Borrowing | null> {
    return this.borrowingModel
      .findById(id)
      .populate('book', 'title author isbn coverImage')
      .populate('member', 'firstName lastName email phone')
      .populate('issuedBy', 'firstName lastName')
      .populate('returnedTo', 'firstName lastName')
      .exec();
  }

  async returnBook(id: string, returnDto: ReturnBookDto, returnedBy: string): Promise<Borrowing> {
    const borrowing = await this.borrowingModel.findById(id);
    if (!borrowing) {
      throw new NotFoundException(`Borrowing record with ID ${id} not found`);
    }

    if (borrowing.status === BorrowingStatus.RETURNED) {
      throw new BadRequestException('This book has already been returned');
    }

    if (borrowing.status === BorrowingStatus.LOST && !returnDto.markAsLost) {
      throw new BadRequestException('This book was marked as lost. Use markAsLost option to confirm.');
    }

    const returnDate = returnDto.returnDate || new Date();

    // Calculate overdue days if applicable
    let overdueDays = 0;
    if (returnDate > borrowing.dueDate) {
      const diffTime = returnDate.getTime() - borrowing.dueDate.getTime();
      overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    const updateData: any = {
      returnDate,
      overdueDays,
      returnedTo: new Types.ObjectId(returnedBy),
      status: returnDto.markAsLost ? BorrowingStatus.LOST : BorrowingStatus.RETURNED,
    };

    if (returnDto.notes) {
      updateData.notes = borrowing.notes
        ? `${borrowing.notes}\n[Return Note]: ${returnDto.notes}`
        : `[Return Note]: ${returnDto.notes}`;
    }

    const updatedBorrowing = await this.borrowingModel
      .findByIdAndUpdate(id, { $set: updateData }, { new: true })
      .populate('book', 'title author isbn coverImage')
      .populate('member', 'firstName lastName email phone')
      .populate('issuedBy', 'firstName lastName')
      .populate('returnedTo', 'firstName lastName')
      .exec();

    // Update book availability (only if not marking as lost)
    if (!returnDto.markAsLost) {
      await this.libraryBookService.updateAvailability(borrowing.book.toString(), 1);
    }

    this.logger.log(`Book returned: ${id} - Status: ${updateData.status}`);

    if (!updatedBorrowing) {
      throw new NotFoundException(`Borrowing record with ID ${id} not found after update`);
    }

    return updatedBorrowing;
  }

  async update(id: string, updateDto: UpdateBorrowingDto): Promise<Borrowing> {
    const borrowing = await this.borrowingModel.findById(id);
    if (!borrowing) {
      throw new NotFoundException(`Borrowing record with ID ${id} not found`);
    }

    if (borrowing.status !== BorrowingStatus.BORROWED) {
      throw new BadRequestException('Can only update active borrowings');
    }

    // Validate new due date if provided
    if (updateDto.dueDate) {
      const newDueDate = new Date(updateDto.dueDate);
      if (newDueDate <= borrowing.borrowDate) {
        throw new BadRequestException('Due date must be after borrow date');
      }
    }

    const updatedBorrowing = await this.borrowingModel
      .findByIdAndUpdate(id, { $set: updateDto }, { new: true })
      .populate('book', 'title author isbn coverImage')
      .populate('member', 'firstName lastName email phone')
      .populate('issuedBy', 'firstName lastName')
      .exec();

    if (!updatedBorrowing) {
      throw new NotFoundException(`Borrowing record with ID ${id} not found after update`);
    }

    this.logger.log(`Borrowing updated: ${id}`);
    return updatedBorrowing;
  }

  async getOverdueBorrowings(branchId: string) {
    // First, update any borrowings that are now overdue
    await this.updateOverdueStatus(branchId);

    const filter: any = {
      status: BorrowingStatus.OVERDUE,
    };

    if (branchId) {
      filter.branch = new Types.ObjectId(branchId);
    }

    const borrowings = await this.borrowingModel
      .find(filter)
      .populate('book', 'title author isbn coverImage')
      .populate('member', 'firstName lastName email phone')
      .populate('issuedBy', 'firstName lastName')
      .sort({ dueDate: 1 })
      .exec();

    // Add current overdue days calculation
    return borrowings.map((b) => {
      const now = new Date();
      const diffTime = now.getTime() - b.dueDate.getTime();
      const currentOverdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return {
        ...b.toObject(),
        currentOverdueDays,
      };
    });
  }

  async getMemberHistory(memberId: string, branchId?: string) {
    const filter: any = {
      member: new Types.ObjectId(memberId),
    };

    if (branchId) {
      filter.branch = new Types.ObjectId(branchId);
    }

    const borrowings = await this.borrowingModel
      .find(filter)
      .populate('book', 'title author isbn coverImage')
      .populate('issuedBy', 'firstName lastName')
      .populate('returnedTo', 'firstName lastName')
      .sort({ borrowDate: -1 })
      .exec();

    const stats = {
      totalBorrowed: borrowings.length,
      currentlyBorrowed: borrowings.filter(
        (b) => b.status === BorrowingStatus.BORROWED || b.status === BorrowingStatus.OVERDUE,
      ).length,
      returned: borrowings.filter((b) => b.status === BorrowingStatus.RETURNED).length,
      overdue: borrowings.filter((b) => b.status === BorrowingStatus.OVERDUE).length,
      lost: borrowings.filter((b) => b.status === BorrowingStatus.LOST).length,
      totalOverdueDays: borrowings.reduce((sum, b) => sum + (b.overdueDays || 0), 0),
    };

    return {
      borrowings,
      stats,
    };
  }

  async updateOverdueStatus(branchId?: string): Promise<number> {
    const now = new Date();
    const filter: any = {
      status: BorrowingStatus.BORROWED,
      dueDate: { $lt: now },
    };

    if (branchId) {
      filter.branch = new Types.ObjectId(branchId);
    }

    const result = await this.borrowingModel.updateMany(filter, {
      $set: { status: BorrowingStatus.OVERDUE, isOverdue: true },
    });

    if (result.modifiedCount > 0) {
      this.logger.log(`Updated ${result.modifiedCount} borrowings to overdue status`);
    }

    return result.modifiedCount;
  }

  async getStatistics(branchId: string) {
    const branchObjectId = new Types.ObjectId(branchId);

    // Update overdue status first
    await this.updateOverdueStatus(branchId);

    const [
      totalBorrowings,
      activeBorrowings,
      overdueCount,
      returnedThisMonth,
      popularBooks,
      topBorrowers,
    ] = await Promise.all([
      this.borrowingModel.countDocuments({ branch: branchObjectId }),
      this.borrowingModel.countDocuments({
        branch: branchObjectId,
        status: { $in: [BorrowingStatus.BORROWED, BorrowingStatus.OVERDUE] },
      }),
      this.borrowingModel.countDocuments({
        branch: branchObjectId,
        status: BorrowingStatus.OVERDUE,
      }),
      this.borrowingModel.countDocuments({
        branch: branchObjectId,
        status: BorrowingStatus.RETURNED,
        returnDate: {
          $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      }),
      // Most borrowed books
      this.borrowingModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: '$book', borrowCount: { $sum: 1 } } },
        { $sort: { borrowCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'books',
            localField: '_id',
            foreignField: '_id',
            as: 'bookDetails',
          },
        },
        { $unwind: '$bookDetails' },
        {
          $project: {
            bookId: '$_id',
            title: '$bookDetails.title',
            author: '$bookDetails.author',
            borrowCount: 1,
          },
        },
      ]),
      // Top borrowers
      this.borrowingModel.aggregate([
        { $match: { branch: branchObjectId } },
        { $group: { _id: '$member', borrowCount: { $sum: 1 } } },
        { $sort: { borrowCount: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'members',
            localField: '_id',
            foreignField: '_id',
            as: 'memberDetails',
          },
        },
        { $unwind: '$memberDetails' },
        {
          $project: {
            memberId: '$_id',
            firstName: '$memberDetails.firstName',
            lastName: '$memberDetails.lastName',
            email: '$memberDetails.email',
            borrowCount: 1,
          },
        },
      ]),
    ]);

    return {
      totalBorrowings,
      activeBorrowings,
      overdueCount,
      returnedThisMonth,
      popularBooks,
      topBorrowers,
    };
  }
}
