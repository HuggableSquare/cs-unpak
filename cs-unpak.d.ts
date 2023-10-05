declare module "cs-unpak" {
  import { EventEmitter } from 'events';
  
  export enum CSUnpakLogLevel {
    Error = 'error',
    Warn = 'warn',
    Info = 'info',
    Verbose = 'verbose',
    Debug = 'debug',
    Silly = 'silly'
  }

  export interface CSUnpakOptions {
    directory: string, // relative data directory for VPK files
    logLevel: CSUnpakLogLevel, // logging level, (error, warn, info, verbose, debug, silly)
    neededDirectories: Array // array of directories to get from the pak files
  }

  export default class CsgoCdn extends EventEmitter {
    constructor(steamUser: any, options: Partial<CSUnpakOptions>);

    getFile(path: string): Buffer;

    on(event: 'ready', listener: () => void): this;
  }
}
