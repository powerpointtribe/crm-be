// Mock types for BullMQ when the packages aren't installed
// These will be replaced by actual BullMQ types once the packages are installed

export interface MockJob<T = any> {
  id: string | number;
  data: T;
  progress(value?: any): any;
  getState(): Promise<string>;
  returnvalue: any;
  failedReason: string;
  remove(): Promise<void>;
}

export interface MockQueue<T = any> {
  add(name: string, data: T, opts?: any): Promise<MockJob<T>>;
  getJob(id: string): Promise<MockJob<T> | null>;
  getJobs(types: string[], start?: number, end?: number): Promise<MockJob<T>[]>;
  getWaiting(): Promise<MockJob<T>[]>;
  getActive(): Promise<MockJob<T>[]>;
  getCompleted(): Promise<MockJob<T>[]>;
  getFailed(): Promise<MockJob<T>[]>;
  getDelayed(): Promise<MockJob<T>[]>;
}

// Mock decorators
export function Process(jobName: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    // Mock implementation
  };
}

export function Processor(queueName: string) {
  return function (constructor: Function) {
    // Mock implementation
  };
}

export function InjectQueue(queueName: string) {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number,
  ) {
    // Mock implementation
  };
}

// Mock module
export const BullModule = {
  forRootAsync: (options: any) => ({
    module: class MockBullModule {},
    imports: options.imports || [],
    providers: [],
    exports: [],
  }),
  registerQueue: (options: any) => ({
    module: class MockQueueModule {},
    providers: [],
    exports: [],
  }),
};
