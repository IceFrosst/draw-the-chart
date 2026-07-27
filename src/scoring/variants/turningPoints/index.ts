import { registerVariant } from '../registry.js';
import { hungarianMatchTurningPoints } from './hungarianMatch.js';
import { crossCorrelationTurningPoints } from './crossCorrelation.js';
import { simplifiedTurningPoints } from './simplified.js';

registerVariant(hungarianMatchTurningPoints);
registerVariant(crossCorrelationTurningPoints);
registerVariant(simplifiedTurningPoints);

export { hungarianMatchTurningPoints, crossCorrelationTurningPoints, simplifiedTurningPoints };
