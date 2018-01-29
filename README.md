# Node Dependency Manager

[![Dependency Status](https://david-dm.org/MitMaro/node-dependency-manager.svg)](https://david-dm.org/MitMaro/node-dependency-manager)
[![Build Status](https://travis-ci.org/MitMaro/node-dependency-manager.svg?branch=master)](https://travis-ci.org/MitMaro/node-dependency-manager)
[![Coverage Status](https://coveralls.io/repos/github/MitMaro/node-dependency-manager/badge.svg?branch=master)](https://coveralls.io/github/MitMaro/node-dependency-manager?branch=master)
[![NPM version](https://img.shields.io/npm/v/@mitmaro/dependency-manager.svg)](https://www.npmjs.com/package/@mitmaro/dependency-manager)
[![GitHub license](https://img.shields.io/badge/license-ISC-blue.svg)](https://raw.githubusercontent.com/MitMaro/node-dependency-manager/master/LICENSE.md)
[![Known Vulnerabilities](https://snyk.io/test/github/mitmaro/node-dependency-manager/badge.svg?targetFile=package.json)](https://snyk.io/test/github/mitmaro/node-dependency-manager?targetFile=package.json)

## Motivation

Wiring together dependant pieces of a JavaScript project can be difficult and tedious. This library aims to provide a
mechanism to manage and provide the dependant parts of a JavaScript project.

## Install

    npm install --save @mitmaro/dependency-manager

## Documentation

* [API Documentation][1]

## Usage

### Creating an instance

Creating a dependency manager instance is pretty straight forward.

```javascript
const {DependencyManager} = require('@mitmaro/dependancy-manager');
const dependencyManager = new DependencyManager({
    // options
});
```

#### Options

|Name              |Type      |Description                                                   |Default |
|------------------|----------|--------------------------------------------------------------|--------|
|argumentInjection |`boolean` |Inject dependencies as arguments instead as an object         |`false` |
|snakeCase         |`boolean` |Use snake case instead of camel case for creating identifiers |`false` |

##### `argumentInjection`

By default the dependencies are injected as an object with keys based on the dependency name. This options will instead
provide the dependencies as arguments to the factory function based on the order of the dependency list. The option
`snakeCase` has no visible effect when using this option.

```javascript
const serviceFactory = (config, database) => {
	// ...
}
dependencyManager.register('service', serviceFactory, ['config', 'database']);
```

##### `snakeCase`

Generally dependencies names are converted to the parameter name in the dependency object using camel case, by providing
this option they will instead be snake cased.

```javascript
const serviceFactory = ({database_connection}) => {
	// ...
}
dependencyManager.register('service', serviceFactory, ['DatabaseConnection']);
```

### Set a static value

The most simple type of dependency is a constant static value. You can provide a constant value using the `set` method.

```javascript
dependencyManager.set('configuration', {
    databaseConnectionUrl: 'postgresql://localhost:5432/',
});
```

Static values should only exist for truly static values. If you are using static with a result of a function call or
with an instance created with `new` you should be using a factory function.

### Register a Factory functions

The way to define an item, that may requires other dependencies, is with a factory function. The factory function takes
the optional dependencies and returns an instance of the dependency. For example to create a database connection that
requires a database connection configuration you would have the factory function:

```javascript
// `configuration` is the constant value set in the previous section
const databaseFactory = ({configuration, database}) => database.connect(configuration.databaseConnectionUrl);

const serviceFactory = ({database}) => (id) => {
    return database.query('SELECT * FROM foo WHERE id = ${id}', {id});
};

dependencyManager.register('database', databaseFactory, ['config']);
dependencyManager.register('service', serviceFactory, ['database']);
```

### Aliasing

Sometimes it is useful to provide an alternative name, an alias, to a dependency. This works with constant and factory
dependencies. Aliases follow the same naming rules as dependencies.

```javascript
dependencyManager.alias('database', 'db');
dependencyManager.alias('configuration', 'config');
```

### Naming

A dependency name must only contain alphanumeric characters, `$`, `_` and `-` characters; and it must not must begin
with a number. The name will be converted to camel cases (or snake case if the option is selected) when it is injected
into a factory function with object injection.

### Namespaces

Most large projects will have dependencies that can be categorized. For example there could be a number of libraries,
utilities or services. In these cases an optional namespace can be prepended to the name to group these common
dependencies. When registering or setting a dependency use he naming format of `namespace:name`. A namespaced dependency
has a slightly different object injection format of `nameNamespace` with `namespace` following the same rules defined in
above for dependency names.

```javascript
const serviceFactory = ({databaseLib}) => (id) => {
    return databaseLib.query('SELECT * FROM foo WHERE id = ${id}', {id});
};

dependencyManager.register('lib:database', databaseFactory, ['config']);
dependencyManager.register('service', serviceFactory, ['lib:database']);
```

### Loading

Once all the dependencies are registered, the next step is to load the dependencies. This is achieved using the `load`
method and it's usage is pretty straight forward:

```javascript
dependencyManager.load()
    .then(() => {
        console.log('Dependencies are all loaded');
        const service = depdenencyManager.get('service');
        return service('my_id');
    })
    .catch((err) => {
        console.error('An error occurred while loading dependencies');
        console.error(err);
    });
```

## Best Practices

### Be immutable

When ever possible the injected dependencies should be immutable. in that once the dependency is set, it should not be
possible to change that dependency. For example:

```javascript
function myService({dependency}) {
    let myDependency = dependency;
    return {
        // this is a bad function
        setDependency(newDependency) {
            myDependency = newDependency;
        }
    }
}
```

### Inject direct dependencies only

While it might be tempting, avoid using the dependencies of a dependencies as this creates a tight coupling.
For example do not do:

```javascript
function myService({dependency}) {
    let mySubDependency = dependency.subDependency;
    // ...
}
```

The alternative is to instead directly inject the dependency:

```javascript
function myService({dependency, subDependency}) {
    // ...
}
```

### Resolving cyclic dependencies

Sometimes you will have one dependency, say `FooService` that has a dependency on `BarService`. `BarService` in turn has
a direct, or indirect, dependency on `FooService`. This will result in an error:

```
Cycle detected in dependencies: FooService > BarService > FooService
```

Assuming the cycle is not an error, there are a couple ways to resolve the cycle.

#### Remove the cycle

Most often a cycle is a sign that the a dependency is performing an action that it should not. To resolve the cycle
extract the dependant functionality into a separate shared dependency.

#### Inject a provider function

Sometimes it is not possible to remove the dependency cycle, in this case you can use a factory function to create a
dependency. For example:

```javascript
function createFooService({anotherDependency, barService}) {
	// ...
}

function fooServiceProvider({anotherDependency}) {
    let fooService;
    return {
        create(barService) {
            fooService = createFooService({anotherDependency, barService});
            return fooService;
        },
        get() {
            return fooService;
        }
    }
}

function createBarService({fooServiceProvider}) {
    let fooService;
    const bar = {
        callFooService() {
            fooService()
        }
    };
    fooService = fooServiceProvider.create(bar);
    return bar;
}
dependencyManager.register('fooServiceProvider', fooServiceProvider, ['anotherDependency']);
dependencyManager.register('barService', fooServiceProvider, ['fooServiceProvider']);
```

The service provider above creates a singleton instance of `fooService`, but this is optional if multiple instances of
`fooService` are desired.

### Avoid side effects

Often you will have a dependency that will make an interaction to an external system, such as opening a database
connection, loading a file for writing, or starting a HTTP server. Avoid performing these, and similar, actions in a
factory function. Instead create a service interface that exposes a function to start and optionally stop the action.
Then call the `start` and `stop` functions as part of your application bootstrap and shutdown. For example:

```javascript
function httpService({http}) {
	let httpConnection;
	const service = {
		start() {
			return http
				.start()
				.then((connection) => {
					httpConnection = connection;
				});
		},
		stop() {
			return httpConnection.end();
		}
	}
}
```

## Development

Development is done using Node 8 and NPM 5, and tested against both Node 6 and Node 8. To get started

* Install Node 8 from [NodeJS.org][node] or using [nvm]
* Clone the repository using `git clone git@github.com:MitMaro/node-dependency-manager.git`
* `cd node-dependency-manager`
* Install the dependencies `npm install`
* Make changes, add tests, etc.
* Run linting and test suite using `npm run test`

## License

This project is released under the ISC license. See [LICENSE](LICENSE.md).


[1]: http://www.mitmaro.ca/node-dependency-manager/

[debug]: https://github.com/visionmedia/debug
[node]:https://nodejs.org/en/download/
[nvm]:https://github.com/creationix/nvm#installation
