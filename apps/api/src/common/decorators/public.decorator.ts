import { SetMetadata } from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../constants.js';

/** Marks a route (or controller) as accessible without a bearer token. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
