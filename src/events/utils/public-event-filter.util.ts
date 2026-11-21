import { EventStatus } from '../schemas/event.schema';

/**
 * Mongo filter for looking an event up by its public slug. Draft events are
 * never visible on public (unauthenticated) routes: they behave exactly like
 * an unknown slug. Published, completed and cancelled events stay visible, so
 * public pages can still say "registration closed" or "event cancelled".
 */
export const publicEventFilter = (slug: string) => ({
  registrationSlug: slug,
  status: { $ne: EventStatus.DRAFT },
});
