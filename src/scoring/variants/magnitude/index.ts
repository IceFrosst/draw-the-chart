import { registerVariant } from '../registry.js';
import { biasRmseMagnitude } from './biasRmse.js';
import { dtwDistanceMagnitude } from './dtwDistance.js';
import { timeWeightedMagnitude } from './timeWeightedError.js';

registerVariant(biasRmseMagnitude);
registerVariant(dtwDistanceMagnitude);
registerVariant(timeWeightedMagnitude);

export { biasRmseMagnitude, dtwDistanceMagnitude, timeWeightedMagnitude };
