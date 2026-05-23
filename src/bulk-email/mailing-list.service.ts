import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  MailingList,
  MailingListDocument,
  MailingListSource,
  MailingListContact,
} from './schemas/mailing-list.schema';
import { Member, MemberDocument } from '../members/schemas/member.schema';
import {
  EventRegistration,
  EventRegistrationDocument,
} from '../events/schemas/event-registration.schema';

@Injectable()
export class MailingListService {
  constructor(
    @InjectModel(MailingList.name)
    private mailingListModel: Model<MailingListDocument>,
    @InjectModel(Member.name)
    private memberModel: Model<MemberDocument>,
    @InjectModel(EventRegistration.name)
    private registrationModel: Model<EventRegistrationDocument>,
  ) {}

  /**
   * Create an empty mailing list
   */
  async create(data: {
    name: string;
    description?: string;
    branchId: string;
    userId?: string;
  }): Promise<MailingListDocument> {
    const existing = await this.mailingListModel.findOne({
      branch: new Types.ObjectId(data.branchId),
      name: data.name,
    });
    if (existing) {
      throw new ConflictException(`A mailing list named "${data.name}" already exists`);
    }

    return this.mailingListModel.create({
      name: data.name,
      description: data.description,
      branch: new Types.ObjectId(data.branchId),
      source: MailingListSource.MANUAL,
      contacts: [],
      contactCount: 0,
      createdBy: data.userId ? new Types.ObjectId(data.userId) : undefined,
    });
  }

  /**
   * Create a mailing list from CSV data (parsed rows)
   */
  async createFromCsv(data: {
    name: string;
    description?: string;
    branchId: string;
    rows: Array<{ email: string; firstName?: string; lastName?: string }>;
    userId?: string;
  }): Promise<MailingListDocument> {
    if (!data.rows.length) {
      throw new BadRequestException('CSV contains no valid rows');
    }

    // Deduplicate by email
    const uniqueEmails = new Map<string, { email: string; firstName?: string; lastName?: string }>();
    for (const row of data.rows) {
      if (row.email?.trim()) {
        uniqueEmails.set(row.email.toLowerCase().trim(), {
          email: row.email.toLowerCase().trim(),
          firstName: row.firstName?.trim(),
          lastName: row.lastName?.trim(),
        });
      }
    }

    // Auto-link to existing members
    const emails = Array.from(uniqueEmails.keys());
    const members = await this.memberModel
      .find({ email: { $in: emails }, isActive: true })
      .select('_id email firstName lastName')
      .lean();

    const memberMap = new Map(members.map((m) => [m.email.toLowerCase(), m]));

    const contacts: MailingListContact[] = Array.from(uniqueEmails.values()).map((row) => {
      const linked = memberMap.get(row.email);
      return {
        email: row.email,
        firstName: row.firstName || linked?.firstName || '',
        lastName: row.lastName || linked?.lastName || '',
        member: linked ? (linked._id as Types.ObjectId) : undefined,
      };
    });

    return this.mailingListModel.create({
      name: data.name,
      description: data.description,
      branch: new Types.ObjectId(data.branchId),
      source: MailingListSource.CSV_IMPORT,
      contacts,
      contactCount: contacts.length,
      createdBy: data.userId ? new Types.ObjectId(data.userId) : undefined,
    });
  }

  /**
   * Create a mailing list from event registrations
   */
  async createFromEvent(data: {
    name: string;
    description?: string;
    eventId: string;
    branchId: string;
    userId?: string;
  }): Promise<MailingListDocument> {
    const registrations = await this.registrationModel
      .find({
        event: new Types.ObjectId(data.eventId),
        'attendeeInfo.email': { $exists: true, $ne: '' },
      })
      .lean();

    if (!registrations.length) {
      throw new BadRequestException('No registrations with email found for this event');
    }

    // Deduplicate and build contacts
    const uniqueEmails = new Map<string, MailingListContact>();
    for (const reg of registrations) {
      const email = reg.attendeeInfo.email?.toLowerCase()?.trim();
      if (email && !uniqueEmails.has(email)) {
        uniqueEmails.set(email, {
          email,
          firstName: reg.attendeeInfo.firstName || '',
          lastName: reg.attendeeInfo.lastName || '',
          member: reg.member as Types.ObjectId | undefined,
        });
      }
    }

    const contacts = Array.from(uniqueEmails.values());

    return this.mailingListModel.create({
      name: data.name,
      description: data.description,
      branch: new Types.ObjectId(data.branchId),
      source: MailingListSource.EVENT,
      sourceEventId: new Types.ObjectId(data.eventId),
      contacts,
      contactCount: contacts.length,
      createdBy: data.userId ? new Types.ObjectId(data.userId) : undefined,
    });
  }

  /**
   * Get all mailing lists for a branch
   */
  async findAll(
    branchId: string,
    query?: { page?: number; limit?: number; search?: string },
  ): Promise<{
    items: MailingListDocument[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const filter: any = { branch: new Types.ObjectId(branchId) };
    if (query?.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const [items, total] = await Promise.all([
      this.mailingListModel
        .find(filter)
        .select('-contacts') // Don't send all contacts in list view
        .populate('createdBy', 'firstName lastName')
        .populate('sourceEventId', 'title')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      this.mailingListModel.countDocuments(filter),
    ]);

    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Get single mailing list with all contacts
   */
  async findById(id: string): Promise<MailingListDocument> {
    const list = await this.mailingListModel
      .findById(id)
      .populate('createdBy', 'firstName lastName')
      .populate('sourceEventId', 'title');

    if (!list) throw new NotFoundException('Mailing list not found');
    return list;
  }

  /**
   * Add contacts to an existing list
   */
  async addContacts(
    id: string,
    contacts: Array<{ email: string; firstName?: string; lastName?: string }>,
    userId?: string,
  ): Promise<MailingListDocument> {
    const list = await this.findById(id);

    const existingEmails = new Set(list.contacts.map((c) => c.email));
    const newContacts: MailingListContact[] = [];

    // Auto-link members
    const newEmails = contacts
      .filter((c) => c.email && !existingEmails.has(c.email.toLowerCase()))
      .map((c) => c.email.toLowerCase());

    const members = await this.memberModel
      .find({ email: { $in: newEmails }, isActive: true })
      .select('_id email')
      .lean();
    const memberMap = new Map(members.map((m) => [m.email.toLowerCase(), m._id]));

    for (const c of contacts) {
      const email = c.email?.toLowerCase()?.trim();
      if (email && !existingEmails.has(email)) {
        existingEmails.add(email);
        newContacts.push({
          email,
          firstName: c.firstName?.trim(),
          lastName: c.lastName?.trim(),
          member: memberMap.get(email) as Types.ObjectId | undefined,
        });
      }
    }

    if (newContacts.length === 0) {
      throw new BadRequestException('No new contacts to add (all duplicates)');
    }

    const updated = await this.mailingListModel.findByIdAndUpdate(
      id,
      {
        $push: { contacts: { $each: newContacts } },
        $inc: { contactCount: newContacts.length },
        updatedBy: userId ? new Types.ObjectId(userId) : undefined,
      },
      { new: true },
    );

    return updated!;
  }

  /**
   * Remove contacts by email
   */
  async removeContacts(id: string, emails: string[]): Promise<MailingListDocument> {
    const lowerEmails = emails.map((e) => e.toLowerCase());
    const updated = await this.mailingListModel.findByIdAndUpdate(
      id,
      {
        $pull: { contacts: { email: { $in: lowerEmails } } },
        $inc: { contactCount: -lowerEmails.length },
      },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Mailing list not found');
    return updated;
  }

  /**
   * Delete a mailing list
   */
  async delete(id: string): Promise<void> {
    const result = await this.mailingListModel.findByIdAndDelete(id);
    if (!result) throw new NotFoundException('Mailing list not found');
  }

  /**
   * Get just the emails from a mailing list (for campaign sending)
   */
  async getContactEmails(ids: string[]): Promise<string[]> {
    const lists = await this.mailingListModel
      .find({ _id: { $in: ids.map((id) => new Types.ObjectId(id)) } })
      .select('contacts.email');

    const emails = new Set<string>();
    for (const list of lists) {
      for (const contact of list.contacts) {
        if (contact.email) emails.add(contact.email);
      }
    }
    return Array.from(emails);
  }
}
