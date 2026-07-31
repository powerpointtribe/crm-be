import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event } from '../schemas/event.schema';
import {
  EventPartner,
  EventPartnerDocument,
  PartnerStatus,
} from '../schemas/event-partner.schema';

const CMIT_PARTNERS = [
  // Pastors
  { name: 'Pastor Ayomide Arowele', email: 'arowele.ayomide@gmail.com' },
  { name: 'Pastor Ayotunde Oyebamiji', email: 'oyebamijiayotunde@gmail.com' },
  { name: 'Pastor Habib Hammed', email: 'habobo67@gmail.com' },
  { name: 'Pastor Juwon Abolarin', email: 'abolarinoluwajuwon@gmail.com' },
  { name: 'Pastor Mayowa Oladunjoye', email: 'mayowaoladunjoye@gmail.com' },
  { name: 'Pastor Emmanuel Olanipekun', email: 'emmanuelolanipekun01@gmail.com' },
  { name: 'Pastor Favour Oriabure', email: 'thefavouroriabure@gmail.com' },
  { name: 'Pastor Peace Bamidele', email: 'bamideleolajesu@gmail.com' },
  { name: 'Pastor Tayo Osiyemi', email: 'tayo.osiyemi@gmail.com' },
  { name: 'Pastor Tolulope Moody', email: 'tolulopemoody@gmail.com' },

  // Directors
  { name: 'Director Blessing Ogunleye', email: 'blessingogunleye2@gmail.com' },
  { name: 'Director Gabriel Ologbonjaiye', email: 'jamesgabriel14@gmail.com' },
  { name: 'Director Stacy Igunbor', email: 'stacyigunbor@gmail.com' },
  { name: 'Director Timilehin Ayodele', email: 'timilehinaayodele@gmail.com' },

  // Ministers
  { name: 'Minister Ifeoluwa Akingbemila', email: 'ifeakin20@gmail.com' },
  { name: 'Minister Emmanuella Anyabuike', email: 'anyabuikeemmanuella@gmail.com' },
  { name: 'Minister Folake Afolabi', email: 'afolakejulianah@gmail.com' },
  { name: 'Minister ThankGod Imabibo', email: 'gthankgod@gmail.com' },
  { name: 'Minister Majemu Olowodola', email: 'majemuolowo1@gmail.com' },
  { name: 'Minister Peace Ichi', email: 'peacebello.pb@gmail.com' },
  { name: 'Minister Tofunmi Akinbo', email: 'olutitofunmi@gmail.com' },
  { name: 'Minister Tosin Oyebanji', email: 'tosinoyebanji77@gmail.com' },
  { name: 'Minister Damilola Obaro', email: 'dami.obaro@cmithub.org' },

  // Others
  { name: 'Ibironke Yekini', email: 'ibironkeyekinni@gmail.com' },
  { name: 'Ibukun Fadare', email: 'ibukun.fadare@cmithub.org' },
  { name: 'Joshua Alao', email: 'halao.joshua@gmail.com' },
  { name: 'Chidi Austin', email: 'austinchidiemmanuel@gmail.com' },
  { name: 'Nnana Egwu', email: 'egwu.nnanna.e@gmail.com' },
  { name: 'Ochuwa Idonije', email: 'ochuwa.idonije@cmithub.org' },
  { name: 'Ayokunle Oluwasanwo', email: 'david.oluwasanwo@gmail.com' },
  { name: 'Dr Banji Oguntunde', email: 'bjbanji@gmail.com' },
  { name: 'Dr Nike Fatiregun', email: 'oreoluwafat@gmail.com' },
  { name: 'Emeka Chukwuleta', email: 'leonardchukwuleta@gmail.com' },
  { name: 'Oluwafunto Falua', email: 'funtolammy@gmail.com' },
];

@Injectable()
export class CmitPartnersSeeder {
  private readonly logger = new Logger(CmitPartnersSeeder.name);
  private readonly eventSlug = 'cmit-cohort-1';

  constructor(
    @InjectModel(Event.name) private eventModel: Model<Event>,
    @InjectModel(EventPartner.name)
    private partnerModel: Model<EventPartnerDocument>,
  ) {}

  async seed() {
    this.logger.log('Seeding CMIT partners...');

    const event = await this.eventModel.findOne({
      registrationSlug: this.eventSlug,
    });

    if (!event) {
      throw new Error(
        `CMIT event "${this.eventSlug}" not found. Seed the event first (npm run seed:cmit-cohort-1).`,
      );
    }

    let created = 0;
    let skipped = 0;

    for (const partner of CMIT_PARTNERS) {
      const existing = await this.partnerModel.findOne({
        event: event._id,
        email: partner.email.toLowerCase(),
      });

      if (existing) {
        this.logger.log(`  ⏭  ${partner.name} already exists — skipping`);
        skipped++;
        continue;
      }

      await this.partnerModel.create({
        event: event._id,
        name: partner.name,
        email: partner.email.toLowerCase(),
        phone: 'N/A',
        interestDetails: 'CMIT Cohort 1 Partner',
        status: PartnerStatus.CONFIRMED,
        confirmedAt: new Date(),
      });

      this.logger.log(`  ✅ ${partner.name}`);
      created++;
    }

    this.logger.log(
      `✅ CMIT partners seeded: ${created} created, ${skipped} skipped (already existed)`,
    );

    return { created, skipped };
  }

  async remove() {
    this.logger.log('Removing CMIT partners...');

    const event = await this.eventModel.findOne({
      registrationSlug: this.eventSlug,
    });

    if (!event) {
      this.logger.warn('CMIT event not found — nothing to remove');
      return { deletedCount: 0 };
    }

    const result = await this.partnerModel.deleteMany({ event: event._id });

    if (result.deletedCount > 0) {
      this.logger.log(`✅ Removed ${result.deletedCount} CMIT partners`);
    } else {
      this.logger.warn('No CMIT partners found to remove');
    }

    return result;
  }
}
