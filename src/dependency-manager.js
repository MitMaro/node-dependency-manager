'use strict';

const camelcase = require('lodash.camelcase');
const debug = require('debug')('mitmaro:dependency-manager');
const snakeCase = require('lodash.snakecase');

const STATUS_NEW = 'new';
const STATUS_LOADING = 'loading';
const STATUS_LOADED = 'loaded';

const identifierRegex = /^[a-zA-Z$_]+[0-9a-zA-Z\-$_]*$/;

module.exports = class DependencyManager {
	constructor(options = {}) {
		this.dependencies = new Map();
		this.aliases = new Map();
		this.status = STATUS_NEW;
		this.path = [];
		this.snakeCase = Boolean(options.snakeCase);
		this.argumentInjection = Boolean(options.argumentInjection);
	}

	_getName(name) {
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

		if (namespace && !namespace.match(identifierRegex)) {
			throw new Error(`The namespace, ${namespace}, is not a valid identifier`);
		}

		if (!label.match(identifierRegex)) {
			throw new Error(`The name, ${label}, is not a valid identifier`);
		}

		const fullname = namespace ? `${label}_${namespace}` : label;
		return this.snakeCase ? snakeCase(fullname) : camelcase(fullname);
	}

	async _load(deps) {
		const loaded = this.argumentInjection ? [] : {};
		for (const depName of deps) {
			debug('loading dependency %s', depName);
			const depNameIdentifier = this._getName(depName);
			const isAlias = this.aliases.has(depNameIdentifier);
			const identifier = isAlias ? this.aliases.get(depNameIdentifier).identifier : depNameIdentifier;

			debug('dependency identifier %s', identifier);
			if (!this.dependencies.has(identifier)) {
				throw new Error(
					`The dependency, ${depName}, is not registered. Path: ${this.path.join(' > ')}`
				);
			}
			const meta = this.dependencies.get(identifier);

			if (meta.status === STATUS_LOADED) {
				debug('%s already loaded', identifier);
				if (this.argumentInjection) {
					loaded.push(meta.instance);
				}
				else {
					loaded[depNameIdentifier] = meta.instance;
				}
				continue;
			}
			if (meta.status === STATUS_LOADING) {
				const depErrorName = isAlias ? `${depName} [${identifier}]` : identifier;
				throw new Error(`Cycle detected in dependencies: ${this.path.join(' > ')} > ${depErrorName}`);
			}
			meta.status = STATUS_LOADING;
			this.path.push(isAlias ? `${depName} [${identifier}]` : identifier);
			debug('loading sub-dependencies for %s', identifier);
			const dependencyInstances = await this._load(meta.dependencies);
			debug('sub-dependencies loaded for %s', identifier);
			debug('creating instance for %s', identifier);
			meta.instance = this.argumentInjection
				? await meta.factory.apply(meta.factory, dependencyInstances)
				: await meta.factory.call(meta.factory, dependencyInstances);
			debug('instance created for %s', identifier);
			if (this.argumentInjection) {
				loaded.push(meta.instance);
			}
			else {
				loaded[depNameIdentifier] = meta.instance;
			}
			this.path.pop();
			meta.status = STATUS_LOADED;
		}
		return loaded;
	}

	register(name, factory, dependencyNames = []) {
		debug('registering %s with dependencies %o', name, dependencyNames);
		const identifier = this._getName(name);

		if (this.dependencies.has(identifier)) {
			const otherDepName = this.dependencies.get(identifier).name;
			throw new Error(
				`Unable to register dependency, ${name}, because it conflicts with dependency, ${otherDepName}`
			);
		}

		if (this.aliases.has(identifier)) {
			const alias = this.aliases.get(identifier).alias;
			throw new Error(`Unable to register dependency, ${name}, because it conflicts with the alias, ${alias}`);
		}

		this.dependencies.set(identifier, {
			name,
			factory,
			instance: null,
			dependencies: dependencyNames,
			status: STATUS_NEW,
		});
	}

	set(name, instance) {
		debug('adding static instance %s', name);
		const identifier = this._getName(name);

		if (this.dependencies.has(identifier)) {
			const otherDepName = this.dependencies.get(identifier).name;
			throw new Error(
				`Unable to set constant value, ${name}, because it conflicts with dependency, ${otherDepName}`
			);
		}

		if (this.aliases.has(identifier)) {
			const alias = this.aliases.get(identifier).alias;
			throw new Error(`Unable to set constant value, ${name}, because it conflicts with the alias, ${alias}`);
		}

		this.dependencies.set(identifier, {
			name,
			factory: null,
			instance,
			dependencies: [],
			status: STATUS_LOADED,
		});
	}

	alias(name, alias) {
		debug('registering alias from %s to %s', alias, name);
		const identifier = this._getName(name);
		const aliasIdentifier = this._getName(alias);

		if (this.dependencies.has(aliasIdentifier)) {
			const depName = this.dependencies.get(aliasIdentifier).name;
			throw new Error(
				`Unable to register alias, ${alias}, because it conflicts with dependency, ${depName}`
			);
		}

		if (this.aliases.has(aliasIdentifier)) {
			const otherAlias = this.aliases.get(aliasIdentifier).alias;
			throw new Error(`Unable to register alias, ${alias}, because it conflicts with the alias, ${otherAlias}`);
		}

		this.aliases.set(aliasIdentifier, {identifier, name, alias});
	}

	get(name) {
		if (this.status !== STATUS_LOADED) {
			throw new Error('Attempt to get dependency before load');
		}

		const identifier = this._getName(name);

		debug('returning dependency %s', name);

		const n = this._getName(
			this.aliases.has(identifier) ? this.aliases.get(identifier).identifier : identifier
		);

		if (!this.dependencies.has(n)) {
			throw new Error(`${name} is not registered as a dependency or alias`);
		}

		return this.dependencies.get(n).instance;
	}

	async load() {
		this.status = STATUS_LOADING;
		debug('start loading dependencies');
		await this._load(this.dependencies.keys());
		debug('finished loading dependencies');
		this.status = STATUS_LOADED;
		return undefined;
	}
};
