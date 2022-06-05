declare type Fn = (...args: any) => any;
declare function createLocalThreadPool(webWorkerModule: new () => Worker, count?: number): void;
interface Actor<F extends Fn, R = ReturnType<F>, A = Awaited<R>> {
    spawnRemote(...args: Parameters<F>): Promise<{
        [Property in keyof A as A[Property] extends Fn ? Property : never]: A[Property] extends Fn ? (...args: Parameters<A[Property]>) => Promise<Awaited<ReturnType<A[Property]>>> : never;
    }>;
    spawnLocal(...args: Parameters<F>): R;
}
declare function Actor<F extends Fn>(actorId: string, f: F): Actor<F>;

export { Actor, createLocalThreadPool };
