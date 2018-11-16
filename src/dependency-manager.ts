// tslint:disable:no-any */
import * as makeDebug from 'debug';
// tslint:disable:no-require-imports
import camelcase = require('lodash.camelcase');
import snakeCase = require('lodash.snakecase');
// tslint:enable:no-require-imports

const debug = makeDebug('mitmaro:dependency-manager');

/** Dependency state */
const enum Status {
	/** Dependency is known by not yet started the loading process */
	New = 'new',
	/** Dependency is in the process of being loaded */
	Loading = 'loading',
	/** Dependency has completed loading */
	Loaded = 'loaded',
}

const identifierRegex = /^[a-zA-Z$_]+[0-9a-zA-Z\-$_]*$/u;

interface Alias {
	identifier: string;
	name: string;
	alias: string;
}

/**
 * A callback for when a dependency is loaded
 * @param instance The dependency instance
 * @param T The type of the dependency instance
 */
export type OnDependencyLoaded<T> = (instance: T) => void;

/**
 * A factory function that accepts dependencies as arguments
 * @param deps The dependency instances
 * @param T The type of the instance returned from the factory
 */
export type ArgumentInjectionFactory<T> = (...deps: any[]) => T;
/**
 * A factory function that accepts dependencies as an object
 * @param deps The dependency instances as an object
 * @param T The type of the instance returned from the factory
 * @param D The type of the dependency object
 */
export type ObjectInjectionFactory<T, D> = (deps: D) => T;
type InjectorFactory<T, D> = ArgumentInjectionFactory<T> | ObjectInjectionFactory<T, D>;

interface DependencyMeta<T, D, F extends InjectorFactory<T, D>> {
	dependencies: string[];
	factory: F;
	instance: T | null;
	name: string;
	onLoaded?: OnDependencyLoaded<T>;
	status: Status;
}

interface DependencySet {
	[dependencyName: string]: any;
}

/** Dependency manager options */
export interface Options {
	/** Inject dependencies as arguments instead as an object */
	argumentInjection?: boolean;
	/** Use snake case instead of camel case for creating identifiers */
	snakeCase?: boolean;
}

/**
 * Guard for InputData
 * @param value The value to check
 * @returns True if the value provided is InputData
 */
function isDependencyNameList<T>(value?: string[] | OnDependencyLoaded<T>): value is string[] {
	return Array.isArray(value);
}

/** Dependency Manager */
export class DependencyManager {
	private readonly _aliases: Map<string, Alias>;
	private readonly _argumentInjection: boolean;
	private readonly _dependencies: Map<string, DependencyMeta<any, any, () => any>>;
	private readonly _path: string[];
	private _status: Status;
	private readonly _snakeCase: boolean;

	/** Create an instance of the dependency manager */
	public constructor(options: Options = {}) {
		this._dependencies = new Map();
		this._aliases = new Map();
		this._status = Status.New;
		this._path = [];
		this._snakeCase = Boolean(options.snakeCase);
		this._argumentInjection = Boolean(options.argumentInjection);
	}

	/**
	 * Register a dependency
	 * @param name The name of the dependency
	 * @param factory The factory function that will create the instance
	 * @param dependencyNamesOrOnLoaded An array of dependency names, or an onLoaded function
	 * @param onDependencyLoaded An onLoaded function
	 * @param T The type of the dependency instance
	 * @param D The type of the dependency factory arguments.
	 */
	public register<T, D>(
		name: string,
		factory: InjectorFactory<T, D>,
		dependencyNamesOrOnLoaded?: string[] | OnDependencyLoaded<T>,
		onDependencyLoaded?: OnDependencyLoaded<T>
	): void {
		const identifier = this._getIdentifier(name);

		let onLoaded: OnDependencyLoaded<T> | undefined;
		let dependencyNames: string[] = [];

		if (isDependencyNameList<T>(dependencyNamesOrOnLoaded)) {
			if (onDependencyLoaded !== undefined) {
				onLoaded = onDependencyLoaded;
			}
			dependencyNames = dependencyNamesOrOnLoaded;
		}
		else if (dependencyNamesOrOnLoaded !== undefined) {
			onLoaded = dependencyNamesOrOnLoaded;
		}

		debug('registering %s with dependencies %o', name, dependencyNames);

		if (this._dependencies.has(identifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const otherDepName = this._dependencies.get(identifier)!.name;
			throw new Error(
				`Unable to register dependency, ${name}, because it conflicts with dependency, ${otherDepName}`
			);
		}

		if (this._aliases.has(identifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const alias = this._aliases.get(identifier)!.alias;
			throw new Error(`Unable to register dependency, ${name}, because it conflicts with the alias, ${alias}`);
		}

		const dependency: DependencyMeta<T, D, InjectorFactory<T, D>> = {
			dependencies: dependencyNames,
			factory,
			instance: null,
			name,
			onLoaded,
			status: Status.New,
		};

		this._dependencies.set(identifier, dependency as DependencyMeta<any, any, () => any>);
	}

	/**
	 * Set a static instance as a dependency
	 * @param name The name of the dependency
	 * @param instance The instance of the dependency
	 * @param T The type of the dependency instance
	 */
	public set<T>(name: string, instance: T): void {
		debug('adding static instance %s', name);
		const identifier = this._getIdentifier(name);

		if (this._dependencies.has(identifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const otherDepName = this._dependencies.get(identifier)!.name;
			throw new Error(
				`Unable to set constant value, ${name}, because it conflicts with dependency, ${otherDepName}`
			);
		}

		if (this._aliases.has(identifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const alias = this._aliases.get(identifier)!.alias;
			throw new Error(`Unable to set constant value, ${name}, because it conflicts with the alias, ${alias}`);
		}

		const dependency: DependencyMeta<T, void, () => T> = {
			dependencies: [],
			factory: (): T => instance,
			instance: null,
			name,
			onLoaded: undefined,
			status: Status.New,
		};

		this._dependencies.set(identifier, dependency);
	}

	/**
	 * Add an alias name to a dependency name
	 * @param name The name of the dependency
	 * @param alias The alias name
	 */
	public alias(name: string, alias: string): void {
		debug('registering alias from %s to %s', alias, name);
		const identifier = this._getIdentifier(name);
		const aliasIdentifier = this._getIdentifier(alias);

		if (this._dependencies.has(aliasIdentifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const depName = this._dependencies.get(aliasIdentifier)!.name;
			throw new Error(
				`Unable to register alias, ${alias}, because it conflicts with dependency, ${depName}`
			);
		}

		if (this._aliases.has(aliasIdentifier)) {
			// eslint-disable-next-line typescript/no-non-null-assertion
			const otherAlias = this._aliases.get(aliasIdentifier)!.alias;
			throw new Error(`Unable to register alias, ${alias}, because it conflicts with the alias, ${otherAlias}`);
		}

		this._aliases.set(aliasIdentifier, {identifier, name, alias});
	}

	/**
	 * Get the instance of dependency
	 * @param name The name of the dependency
	 * @param T The type of the dependency instance
	 * @returns The dependency instance
	 * @throws {Error} if the dependencies have not been loaded or the dependency does not exist
	 */
	public get<T>(name: string): T {
		if (this._status !== Status.Loaded) {
			throw new Error('Attempt to get dependency before load');
		}

		const identifier = this._getIdentifier(name);

		debug('returning dependency %s', name);

		const n = this._getIdentifier(
			// eslint-disable-next-line typescript/no-non-null-assertion
			this._aliases.has(identifier) ? this._aliases.get(identifier)!.identifier : identifier
		);

		if (!this._dependencies.has(n)) {
			throw new Error(`${name} is not registered as a dependency or alias`);
		}

		// eslint-disable-next-line typescript/no-non-null-assertion
		return this._dependencies.get(n)!.instance;
	}

	/**
	 * Load all registered dependencies
	 */
	public async load(): Promise<void> {
		this._status = Status.Loading;
		debug('start loading dependencies');
		await this._load(Array.from(this._dependencies.keys()));
		debug('finished loading dependencies');
		this._status = Status.Loaded;
	}

	/**
	 * Get the normalized identifier for a dependency
	 * @param name The name of the dependency
	 * @returns The normalized identifier
	 * @private
	 */
	private _getIdentifier(name: string): string {
		let namespace;
		let label;

		const namespaceEndIndex = name.indexOf(':');
		if (namespaceEndIndex === -1) {
			namespace = null;
			label = name;
		}
		else {
			namespace = name.slice(0, namespaceEndIndex);
			label = name.slice(namespaceEndIndex + 1);
		}

		if (namespace !== null && namespace.match(identifierRegex) === null) {
			throw new Error(`The namespace, ${namespace}, is not a valid identifier`);
		}

		if (label.match(identifierRegex) === null) {
			throw new Error(`The name, ${label}, is not a valid identifier`);
		}

		const fullname = namespace === null ? label : `${label}_${namespace}`;
		return this._snakeCase ? snakeCase(fullname) : camelcase(fullname);
	}

	/**
	 * Load a list of dependencies by name
	 * @param dependencyNames A list of dependency names to load
	 * @returns The set of dependencies
	 * @private
	 */
	private async _load(dependencyNames: string[]): Promise<DependencySet | any[]> {
		const loaded = this._argumentInjection ? [] : {};
		for (const depName of dependencyNames) {
			debug('loading dependency %s', depName);
			const depNameIdentifier = this._getIdentifier(depName);
			const isAlias = this._aliases.has(depNameIdentifier);
			// eslint-disable-next-line typescript/no-non-null-assertion
			const identifier = isAlias ? this._aliases.get(depNameIdentifier)!.identifier : depNameIdentifier;

			debug('dependency identifier %s', identifier);
			if (!this._dependencies.has(identifier)) {
				throw new Error(
					`The dependency, ${depName}, is not registered. Path: ${this._path.join(' > ')}`
				);
			}
			// eslint-disable-next-line typescript/no-non-null-assertion
			const meta = this._dependencies.get(identifier)!;

			if (meta.status === Status.Loaded) {
				debug('%s already loaded', identifier);
				if (this._argumentInjection) {
					(loaded as any[]).push(meta.instance);
				}
				else {
					(loaded as DependencySet)[depNameIdentifier] = meta.instance;
				}
				continue;
			}
			if (meta.status === Status.Loading) {
				const depErrorName = isAlias ? `${depName} [${identifier}]` : identifier;
				throw new Error(`Cycle detected in dependencies: ${this._path.join(' > ')} > ${depErrorName}`);
			}
			meta.status = Status.Loading;
			this._path.push(isAlias ? `${depName} [${identifier}]` : identifier);
			debug('loading sub-dependencies for %s', identifier);
			const dependencyInstances = await this._load(meta.dependencies);
			debug('sub-dependencies loaded for %s', identifier);
			debug('creating instance for %s', identifier);
			meta.instance = this._argumentInjection
				? await meta.factory.apply(meta.factory, dependencyInstances)
				: await meta.factory.call(meta.factory, dependencyInstances);
			debug('instance created for %s', identifier);
			if (this._argumentInjection) {
				(loaded as any[]).push(meta.instance);
			}
			else {
				(loaded as DependencySet)[depNameIdentifier] = meta.instance;
			}
			this._path.pop();
			meta.status = Status.Loaded;
			if (meta.onLoaded !== undefined) {
				meta.onLoaded(meta.instance);
			}
		}
		return loaded;
	}
}
