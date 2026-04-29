import { Profile } from 'src/types';

export class PaginationLinks {
  self!: string;
  next!: string | null;
  prev!: string | null;
}

export class PaginatedResponse {
  status: 'success' = 'success';
  page!: number;
  limit!: number;
  total!: number;
  total_pages!: number;
  links!: PaginationLinks;
  data!: Profile[];

  constructor(options: {
    page: number;
    limit: number;
    total: number;
    data: Profile[];
    baseUrl: string;
    queryParams?: Record<string, unknown>;
  }) {
    this.page = options.page;
    this.limit = options.limit;
    this.total = options.total;
    this.total_pages = Math.ceil(options.total / options.limit);
    this.data = options.data;

    const url = new URL(options.baseUrl);
    const params = new URLSearchParams();

    if (options.queryParams) {
      Object.entries(options.queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
    }

    params.set('page', String(options.page));
    params.set('limit', String(options.limit));
    url.search = params.toString();

    this.links = {
      self: url.toString(),
      next: null,
      prev: null,
    };

    if (options.page < this.total_pages) {
      const nextParams = new URLSearchParams(params.toString());
      nextParams.set('page', String(options.page + 1));
      const nextUrl = new URL(url.toString());
      nextUrl.search = nextParams.toString();
      this.links.next = nextUrl.toString();
    }

    if (options.page > 1) {
      const prevParams = new URLSearchParams(params.toString());
      prevParams.set('page', String(options.page - 1));
      const prevUrl = new URL(url.toString());
      prevUrl.search = prevParams.toString();
      this.links.prev = prevUrl.toString();
    }
  }
}
