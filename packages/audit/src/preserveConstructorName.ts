export type Constructor<T = any> = abstract new (...args: any[]) => T;

/**
 * Helper function to preserve constructor metadata when wrapping
 */
function preserveConstructorName<T extends Constructor>(
    originalConstructor: T,
    wrappedConstructor: T,
): T {
    // Copy the name property
    Object.defineProperty(wrappedConstructor, "name", {
        value: originalConstructor.name,
        configurable: true,
        enumerable: false,
        writable: false,
    });

    // Copy prototype properties
    // Object.setPrototypeOf(wrappedConstructor, originalConstructor);
    // Object.setPrototypeOf(wrappedConstructor.prototype, originalConstructor.prototype);

    // // Copy static properties
    // Object.getOwnPropertyNames(originalConstructor).forEach(name => {
    //     if (name !== 'length' && name !== 'prototype' && name !== 'name') {
    //         const descriptor = Object.getOwnPropertyDescriptor(originalConstructor, name);
    //         if (descriptor) {
    //             Object.defineProperty(wrappedConstructor, name, descriptor);
    //         }
    //     }
    // });

    return wrappedConstructor;
}

export { preserveConstructorName };
export default preserveConstructorName;
