import Mutex from './mutex.ts';
import { WASMInterface } from './WASMInterface.ts';
import type { IWASMInterface } from './WASMInterface.ts';

export default async function lockedCreate(
  mutex: Mutex, binary: any, hashLength: number,
): Promise<IWASMInterface> {
  const unlock = await mutex.lock();
  const wasm = await WASMInterface(binary, hashLength);
  unlock();
  return wasm;
}
