import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

// Schemas
import { Book, BookSchema } from './schemas/book.schema';
import { BookCategory, BookCategorySchema } from './schemas/book-category.schema';
import { Borrowing, BorrowingSchema } from './schemas/borrowing.schema';

// Services
import { LibraryBookService } from './library-book.service';
import { LibraryCategoryService } from './library-category.service';
import { LibraryBorrowingService } from './library-borrowing.service';

// Controllers
import { LibraryBookController } from './library-book.controller';
import { LibraryCategoryController } from './library-category.controller';
import { LibraryBorrowingController } from './library-borrowing.controller';

// Other modules
import { CommonModule } from '../common/common.module';
import { RolesModule } from '../roles/roles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Book.name, schema: BookSchema },
      { name: BookCategory.name, schema: BookCategorySchema },
      { name: Borrowing.name, schema: BorrowingSchema },
    ]),
    CommonModule,
    RolesModule,
    forwardRef(() => AuditLogsModule),
  ],
  controllers: [
    LibraryBookController,
    LibraryCategoryController,
    LibraryBorrowingController,
  ],
  providers: [
    LibraryBookService,
    LibraryCategoryService,
    LibraryBorrowingService,
  ],
  exports: [
    LibraryBookService,
    LibraryCategoryService,
    LibraryBorrowingService,
    MongooseModule,
  ],
})
export class LibraryModule {}
