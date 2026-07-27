import { registerVariant } from '../registry.js';
import { multiScaleDirection } from './multiScale.js';
import { correlationBasedDirection } from './correlationBased.js';
import { dtwDirection } from './dtwDirection.js';

registerVariant(multiScaleDirection);
registerVariant(correlationBasedDirection);
registerVariant(dtwDirection);

export { multiScaleDirection, correlationBasedDirection, dtwDirection };
