export const globalConfig = {
    verbose: true,
}

export function PRINT(...args: any[]) {
    if (globalConfig.verbose) {
        console.log(...args);
    }
}