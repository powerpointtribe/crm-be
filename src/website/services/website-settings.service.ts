import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { UpdateWebsiteSettingsDto } from '../dto/settings.dto';
import {
  CONTACT_EMAIL_KEYS,
  PLATFORM_KEYS,
  WebsiteSettings,
  WebsiteSettingsDocument,
} from '../schemas/website-settings.schema';

const KEY = 'site';

@Injectable()
export class WebsiteSettingsService {
  constructor(
    @InjectModel(WebsiteSettings.name)
    private readonly model: Model<WebsiteSettingsDocument>,
  ) {}

  /** Staff view: the raw singleton, or an empty one if it was never saved. */
  async get(): Promise<Partial<WebsiteSettings>> {
    const doc = await this.model.findOne({ key: KEY }).lean().exec();
    return (
      doc ?? {
        key: KEY,
        serviceStrip: [],
        platformUrls: {},
        heroVideo: {},
        contactEmails: {},
      }
    );
  }

  /** Merge-per-key update; creates the singleton on first save. */
  async update(dto: UpdateWebsiteSettingsDto, actorId?: Types.ObjectId) {
    const set: Record<string, unknown> = { updatedBy: actorId };
    if (dto.serviceStrip !== undefined) set.serviceStrip = dto.serviceStrip;
    if (dto.dcCohortDate !== undefined) set.dcCohortDate = dto.dcCohortDate;
    for (const [group, value] of [
      ['platformUrls', dto.platformUrls],
      ['heroVideo', dto.heroVideo],
      ['contactEmails', dto.contactEmails],
    ] as const) {
      if (!value) continue;
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) set[`${group}.${k}`] = v;
      }
    }
    return this.model
      .findOneAndUpdate(
        { key: KEY },
        { $set: set, $setOnInsert: { key: KEY } },
        { new: true, upsert: true, runValidators: true },
      )
      .lean()
      .exec();
  }

  /** Public view: fixed keys, null for anything unset. */
  async getPublic() {
    const s = await this.get();
    const pick = <K extends string>(
      keys: readonly K[],
      src?: Partial<Record<K, string | null>>,
    ) =>
      Object.fromEntries(keys.map((k) => [k, src?.[k] ?? null])) as Record<
        K,
        string | null
      >;
    return {
      serviceStrip: (s.serviceStrip ?? []).map(
        ({ label, day, time, note }) => ({
          label,
          day,
          time,
          note: note ?? null,
        }),
      ),
      platformUrls: pick(PLATFORM_KEYS, s.platformUrls),
      heroVideo: {
        url: s.heroVideo?.url ?? null,
        posterUrl: s.heroVideo?.posterUrl ?? null,
        posterAlt: s.heroVideo?.posterAlt ?? null,
      },
      dcCohortDate: s.dcCohortDate ?? null,
      contactEmails: pick(CONTACT_EMAIL_KEYS, s.contactEmails),
    };
  }
}
