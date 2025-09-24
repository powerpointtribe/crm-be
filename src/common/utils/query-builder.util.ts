import { FilterQuery } from 'mongoose';

export class QueryBuilder {
  static buildSearchQuery(
    searchTerm: string,
    searchFields: string[],
  ): FilterQuery<any> {
    if (!searchTerm || !searchFields.length) {
      return {};
    }

    const searchRegex = new RegExp(searchTerm, 'i');

    return {
      $or: searchFields.map((field) => ({
        [field]: { $regex: searchRegex },
      })),
    };
  }

  static buildSortQuery(
    sortBy: string,
    sortOrder: 'asc' | 'desc',
  ): Record<string, 1 | -1> {
    if (!sortBy) {
      return { createdAt: -1 };
    }

    return {
      [sortBy]: sortOrder === 'asc' ? 1 : -1,
    };
  }

  static buildDateRangeQuery(
    startDate?: Date,
    endDate?: Date,
    dateField: string = 'createdAt',
  ): FilterQuery<any> {
    if (!startDate && !endDate) {
      return {};
    }

    const query: any = {};

    if (startDate && endDate) {
      query[dateField] = {
        $gte: startDate,
        $lte: endDate,
      };
    } else if (startDate) {
      query[dateField] = { $gte: startDate };
    } else if (endDate) {
      query[dateField] = { $lte: endDate };
    }

    return query;
  }
}
