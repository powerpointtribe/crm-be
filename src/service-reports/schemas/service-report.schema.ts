import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ServiceReportDocument = ServiceReport & Document;

export enum ServiceTag {
  INVITED_GUEST_MINISTER = 'invited_guest_minister',
  SUNDAY_AFTER_SATURDAY_OUTREACH = 'sunday_after_saturday_outreach',
  THEMED_SERVICE = 'themed_service',
  BEGINNING_OF_NEW_SERIES = 'beginning_of_new_series',
  CONTINUATION_OF_SERIES = 'continuation_of_series',
  CELEBRATION_SERVICE = 'celebration_service',
  SUNDAY_AFTER_VIRAL_POST = 'sunday_after_viral_post',
  OTHERS = 'others',
}

@Schema({ timestamps: true })
export class ServiceReport {
  @Prop({ type: Types.ObjectId, ref: 'Branch', required: true, index: true })
  branch: Types.ObjectId;

  @Prop({ required: true })
  date: Date;

  @Prop({ required: true, trim: true })
  serviceName: string;

  @Prop({ type: [String], enum: ServiceTag, default: [] })
  serviceTags: ServiceTag[];

  @Prop({ required: true, min: 0 })
  totalAttendance: number;

  // Gender/age breakdown. Not required for head-count-only reports (special
  // events), where only the total attendance is captured — defaults to 0.
  @Prop({ required: false, default: 0, min: 0 })
  numberOfMales: number;

  @Prop({ required: false, default: 0, min: 0 })
  numberOfFemales: number;

  @Prop({ required: false, default: 0, min: 0 })
  numberOfChildren: number;

  @Prop({ required: true, min: 0 })
  numberOfFirstTimers: number;

  // Special-event flag: when true the males+females+children breakdown is
  // relaxed and only the head count (totalAttendance) is required.
  @Prop({ default: false })
  headcountOnly: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Member', required: true })
  reportedBy: Types.ObjectId;

  @Prop({ trim: true })
  seriesName?: string;

  @Prop({ trim: true })
  notes?: string;

  @Prop({ default: true })
  isActive: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export const ServiceReportSchema = SchemaFactory.createForClass(ServiceReport);

// Add indexes for better query performance
ServiceReportSchema.index({ date: -1 });
ServiceReportSchema.index({ serviceName: 1 });
ServiceReportSchema.index({ reportedBy: 1 });
ServiceReportSchema.index({ isActive: 1 });

// Virtual to calculate attendance breakdown
ServiceReportSchema.virtual('attendanceBreakdown').get(function () {
  return {
    total: this.totalAttendance,
    males: this.numberOfMales,
    females: this.numberOfFemales,
    children: this.numberOfChildren,
    adults: this.numberOfMales + this.numberOfFemales,
    firstTimers: this.numberOfFirstTimers,
    returningMembers: this.totalAttendance - this.numberOfFirstTimers,
  };
});

// Validation to ensure attendance numbers add up correctly
ServiceReportSchema.pre('save', function (next) {
  // Head-count-only (special event) reports skip the gender/age breakdown rule.
  if (!this.headcountOnly) {
    const calculatedTotal =
      this.numberOfMales + this.numberOfFemales + this.numberOfChildren;

    if (calculatedTotal !== this.totalAttendance) {
      const error = new Error(
        `Total attendance (${this.totalAttendance}) must equal sum of males (${this.numberOfMales}) + females (${this.numberOfFemales}) + children (${this.numberOfChildren}) = ${calculatedTotal}`,
      );
      return next(error);
    }
  }

  if (this.numberOfFirstTimers > this.totalAttendance) {
    const error = new Error(
      `Number of first timers (${this.numberOfFirstTimers}) cannot exceed total attendance (${this.totalAttendance})`,
    );
    return next(error);
  }

  next();
});
