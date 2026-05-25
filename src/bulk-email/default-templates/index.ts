import { TemplateCategory, TemplateModule, VariableDefinition } from '../schemas/email-template.schema';

export interface TemplateDefinition {
  slug: string;
  name: string;
  module: TemplateModule;
  category: TemplateCategory;
  subject: string;
  htmlContent: string;
  variableDefinitions: VariableDefinition[];
}

import { membersDefaults } from './members.defaults';
import { firstTimersDefaults } from './first-timers.defaults';
import { groupsDefaults } from './groups.defaults';
import { eventsDefaults } from './events.defaults';
import { authDefaults } from './auth.defaults';

const allDefaults: TemplateDefinition[] = [
  ...membersDefaults,
  ...firstTimersDefaults,
  ...groupsDefaults,
  ...eventsDefaults,
  ...authDefaults,
];

export const defaultTemplateRegistry: Record<string, TemplateDefinition> = {};
for (const t of allDefaults) {
  defaultTemplateRegistry[t.slug] = t;
}

export { membersDefaults, firstTimersDefaults, groupsDefaults, eventsDefaults, authDefaults };
