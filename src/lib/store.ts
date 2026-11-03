import { map } from 'nanostores';

// Shared state between islands on a page. Scrolly sections write their
// active step here; any visualization can subscribe by scrolly id.
export const scrollySteps = map<Record<string, number>>({});
