// Type definitions for @mitmaro/dependency-manager 0.0.1
// Project: @mitmaro/dependency-manager
// Definitions by: Tim Oram <https://github.com/MitMaro>

interface IOptions {
	/** Toggle the use of snake case in identifiers */
	snakeCase?: boolean;
	/** Toggle the use of argument injection */
	argumentInjection?: boolean;
}

export class DependencyManager {
	/**
	 * Create an instance of the dependency manager
	 * @param options
	 */
	public constructor(options?: IOptions);

	/**
	 * Register a dependency
	 * @param name The name of the dependency
	 * @param factory The factory function that will create the instance
	 * @param dependencyNames An array of dependency names
	 * @throws {Error} if there is a invalid dependency
	 */
	public register<T, D>(name: string, factory: (deps: D) => T, dependencyNames?: string[]): void;

	/**
	 * Set a static instance as a dependency
	 * @param name The name of the dependency
	 * @param instance The instance of the dependency
	 * @throws {Error} if there is a invalid dependency
	 */
	public set<T>(name: string, instance: T): void;

	/**
	 * Add an alias name to a dependency name
	 * @param name The name of the dependency
	 * @param alias The alias name
	 * @throws {Error} if there is a invalid dependency
	 */
	public alias(name: string, alias: string): void;

	/**
	 * Get the instance of dependency
	 * @param name The name of the dependency
	 * @returns The dependency instance
	 * @throws {Error} if the dependencies have not been loaded or the dependency does not exist
	 */
	public get<T>(name: string): T;

	/**
	 * Load all registered dependencies
	 * @throws {Error} if a dependencies does not exist or cannot be loaded
	 */
	public load(): Promise<void>;
}
