import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  FaqPage,
  SnippetKind,
  WebDevotional,
  WebDevotionalDocument,
  WebFaq,
  WebFaqDocument,
  WebPastor,
  WebPastorDocument,
  WebSnippet,
  WebSnippetDocument,
  WebTestimony,
  WebTestimonyDocument,
} from '../schemas/web-content.schema';
import { publishedFilter } from '../schemas/publishing';
import { orNull, publicBranch } from '../utils/public-shape.util';
import { ContentStore } from './content-store';

const ORDER = { order: 1 as const, _id: 1 as const };

/** Devotionals, pastors, testimonies, snippets and FAQs. */
@Injectable()
export class WebContentService {
  readonly devotionals: ContentStore<WebDevotional>;
  readonly pastors: ContentStore<WebPastor>;
  readonly testimonies: ContentStore<WebTestimony>;
  readonly snippets: ContentStore<WebSnippet>;
  readonly faqs: ContentStore<WebFaq>;

  constructor(
    @InjectModel(WebDevotional.name)
    private readonly devotionalModel: Model<WebDevotionalDocument>,
    @InjectModel(WebPastor.name)
    private readonly pastorModel: Model<WebPastorDocument>,
    @InjectModel(WebTestimony.name)
    private readonly testimonyModel: Model<WebTestimonyDocument>,
    @InjectModel(WebSnippet.name)
    private readonly snippetModel: Model<WebSnippetDocument>,
    @InjectModel(WebFaq.name)
    private readonly faqModel: Model<WebFaqDocument>,
  ) {
    this.devotionals = new ContentStore<WebDevotional>(devotionalModel, {
      searchFields: ['title'],
      sort: { date: -1 },
    });
    this.pastors = new ContentStore<WebPastor>(pastorModel, {
      searchFields: ['name', 'role'],
      sort: ORDER,
    });
    this.testimonies = new ContentStore<WebTestimony>(testimonyModel, {
      searchFields: ['name', 'body'],
      sort: ORDER,
    });
    this.snippets = new ContentStore<WebSnippet>(snippetModel, {
      searchFields: ['name', 'body'],
      sort: { kind: 1, ...ORDER },
    });
    this.faqs = new ContentStore<WebFaq>(faqModel, {
      searchFields: ['question', 'body'],
      sort: { page: 1, ...ORDER },
    });
  }

  async publicDevotionals(limit = 3) {
    const docs = await this.devotionalModel
      .find(publishedFilter<WebDevotional>())
      .sort({ date: -1, _id: -1 })
      .limit(limit)
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: d._id,
      title: d.title,
      date: d.date,
      url: orNull(d.url),
      audioUrl: orNull(d.audioUrl),
      excerpt: orNull(d.excerpt),
    }));
  }

  async publicPastors() {
    const docs = await this.pastorModel
      .find(publishedFilter<WebPastor>())
      .sort(ORDER)
      .populate('branch', 'slug name')
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: d._id,
      name: d.name,
      role: d.role,
      bio: orNull(d.bio),
      photoUrl: orNull(d.photoUrl),
      photoAlt: orNull(d.photoAlt),
      branch: publicBranch(d.branch as never),
    }));
  }

  async publicTestimonies() {
    const docs = await this.testimonyModel
      .find({ ...publishedFilter<WebTestimony>(), approved: true })
      .sort(ORDER)
      .populate('branch', 'slug name')
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: d._id,
      name: d.name,
      body: d.body,
      imageUrl: orNull(d.imageUrl),
      branch: publicBranch(d.branch as never),
    }));
  }

  async publicSnippets(kind: SnippetKind) {
    const docs = await this.snippetModel
      .find({ ...publishedFilter<WebSnippet>(), kind })
      .sort(ORDER)
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: d._id,
      kind: d.kind,
      name: d.name,
      body: d.body,
    }));
  }

  async publicFaqs(page: FaqPage) {
    const docs = await this.faqModel
      .find({ ...publishedFilter<WebFaq>(), page })
      .sort(ORDER)
      .lean()
      .exec();
    return docs.map((d) => ({
      _id: d._id,
      question: d.question,
      body: d.body,
    }));
  }
}
