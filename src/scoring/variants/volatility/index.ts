import { registerVariant } from '../registry.js';
import { quarterBasedVolatility } from './quarterBased.js';
import { rollingWindowVolatility } from './rollingWindow.js';
import { multiScaleVolatility } from './multiScaleVol.js';

registerVariant(quarterBasedVolatility);
registerVariant(rollingWindowVolatility);
registerVariant(multiScaleVolatility);

export { quarterBasedVolatility, rollingWindowVolatility, multiScaleVolatility };
