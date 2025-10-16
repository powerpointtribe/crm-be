import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { UnitType } from '../../common/enums/dashboard-modules.enums';

export type UnitDocument = Unit & Document;

@Schema({
  timestamps: true,
  versionKey: false,
})
export class Unit {
  @Prop({ type: Types.ObjectId })
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  leader: Types.ObjectId; // Only LXL members can be unit leaders

  @Prop({
    type: String,
    enum: Object.values(UnitType),
    required: true,
  })
  unitType: UnitType;

  @Prop({ type: Types.ObjectId, ref: 'Ministry', required: true })
  ministry: Types.ObjectId; // Every unit must be under a ministry

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Date })
  createdAt: Date;

  @Prop({ type: Date })
  updatedAt: Date;
}

export const UnitSchema = SchemaFactory.createForClass(Unit);

UnitSchema.index({ name: 1 });
UnitSchema.index({ leader: 1 });
UnitSchema.index({ ministry: 1 });
UnitSchema.index({ unitType: 1 });
UnitSchema.index({ createdAt: -1 });
