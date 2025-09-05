import { Static, Type as T } from "@sinclair/typebox";

export const SiteQuery = T.Object({
  site: T.String(),
  selector: T.Optional(T.Object({
    title: T.String(),
    content: T.String()
  }))
});

export type TSiteQuery = Static<typeof SiteQuery>;

export interface Scraper {
  compare: (siteInfo: TSiteQuery, save?: boolean) => Promise<{ content: string, updated: boolean; } | undefined>;
  stop: () => Promise<boolean>;
}
