'use strict';

const sinon = require('sinon');
const DependencyManager = require('../../src/dependency-manager');

describe('dependency-manager', function () {
	it('should load without a dependency', async function () {
		const dm = new DependencyManager();
		const libStub = sinon.stub().resolves('instance-value');

		dm.register('foo', libStub);

		await dm.load();

		expect(dm.get('foo')).to.equal('instance-value');
		expect(libStub).to.be.calledWithExactly({});
	});

	it('should load with a dependency', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('foo', sinon.stub().resolves('foo-value'));
		dm.register('bar', barStub, ['foo']);

		await dm.load();

		expect(dm.get('foo')).to.equal('foo-value');
		expect(dm.get('bar')).to.equal('bar-value');
		expect(barStub).to.be.calledWithExactly({foo: 'foo-value'});
	});

	it('should load with a dependency using the argument injection', async function () {
		const dm = new DependencyManager({argumentInjection: true});
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('foo', sinon.stub().resolves('foo-value'));
		dm.register('baz', sinon.stub().resolves('baz-value'));
		dm.register('bar', barStub, ['foo', 'baz']);

		await dm.load();

		expect(barStub).to.be.calledWithExactly('foo-value', 'baz-value');
	});

	it('should load with a dependency using snake case', async function () {
		const dm = new DependencyManager({snakeCase: true});
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('foo-dep', sinon.stub().resolves('foo-value'));
		dm.set('bazDep', 'baz-value');
		dm.set('lib:fooBar', 'foobar-value');
		dm.alias('bazDep', 'baz-alias');
		dm.register('bar', barStub, ['foo-dep', 'bazDep', 'lib:fooBar', 'baz-alias']);

		await dm.load();

		/* eslint-disable camelcase */
		expect(barStub).to.be.calledWithExactly({
			foo_dep: 'foo-value',
			baz_dep: 'baz-value',
			foo_bar_lib: 'foobar-value',
			baz_alias: 'baz-value',
		});
		/* eslint-enable camelcase */
	});

	it('should load with a dependency using camelCase', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('foo-dep', sinon.stub().resolves('foo-value'));
		dm.set('baz_dep', 'baz-value');
		dm.alias('baz_dep', 'baz-alias');
		dm.register('bar', barStub, ['foo-dep', 'baz_dep', 'baz-alias']);

		await dm.load();

		/* eslint-disable camelcase */
		expect(barStub).to.be.calledWithExactly({
			fooDep: 'foo-value',
			bazDep: 'baz-value',
			bazAlias: 'baz-value',
		});
		/* eslint-enable camelcase */
	});

	it('should load with a dependency using namespaces', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('lib:foo-dep', sinon.stub().resolves('foo-value'));
		dm.set('lib:baz_dep', 'baz-value');
		dm.alias('lib:baz_dep', 'lib:baz-alias');
		dm.register('lib:bar', barStub, ['lib:foo-dep', 'lib:baz_dep', 'lib:baz-alias']);

		await dm.load();

		/* eslint-disable camelcase */
		expect(barStub).to.be.calledWithExactly({
			fooDepLib: 'foo-value',
			bazDepLib: 'baz-value',
			bazAliasLib: 'baz-value',
		});
		/* eslint-enable camelcase */
	});

	it('should load with multiple dependencies', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('foo', sinon.stub().resolves('foo-value'));
		dm.register('baz', sinon.stub().resolves('baz-value'));
		dm.register('bar', barStub, ['foo', 'baz']);

		await dm.load();

		expect(dm.get('foo')).to.equal('foo-value');
		expect(dm.get('bar')).to.equal('bar-value');
		expect(barStub).to.be.calledWithExactly({foo: 'foo-value', baz: 'baz-value'});
	});

	it('should load with same dependency in multiple dependencies', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');
		const bazStub = sinon.stub().resolves('baz-value');

		dm.register('foo', sinon.stub().resolves('foo-value'));
		dm.register('bar', barStub, ['foo']);
		dm.register('baz', bazStub, ['foo']);

		await dm.load();

		expect(barStub).to.be.calledWithExactly({foo: 'foo-value'});
		expect(bazStub).to.be.calledWithExactly({foo: 'foo-value'});
	});

	it('should set a static instance', async function () {
		const dm = new DependencyManager();

		dm.set('static-name', 'static-value');

		await dm.load();

		expect(dm.get('static-name')).to.equal('static-value');
	});

	it('should load with a static instance dependency', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.set('staticName', 'static-value');
		dm.register('bar', barStub, ['staticName']);

		await dm.load();

		expect(barStub).to.be.calledWith({staticName: 'static-value'});
		expect(dm.get('bar')).to.equal('bar-value');
	});

	it('should load an alias', async function () {
		const dm = new DependencyManager();
		const libStub = sinon.stub().resolves('instance-value');

		dm.register('foo', libStub);
		dm.alias('foo', 'bar');

		await dm.load();

		expect(dm.get('bar')).to.equal('instance-value');
	});

	it('should load with an alias as a dependency', async function () {
		const dm = new DependencyManager();
		const bazStub = sinon.stub().resolves('baz-value');

		dm.register('foo', sinon.stub().resolves('foo-value'));
		dm.alias('foo', 'bar');
		dm.register('baz', bazStub, ['bar']);

		await dm.load();

		expect(bazStub).to.be.calledWith({bar: 'foo-value'});
	});

	it('should load with dependencies registered after', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('bar', barStub, ['foo']);
		dm.register('foo', sinon.stub().resolves('foo-value'));

		await dm.load();

		expect(dm.get('foo')).to.equal('foo-value');
		expect(dm.get('bar')).to.equal('bar-value');
		expect(barStub).to.be.calledWithExactly({foo: 'foo-value'});
	});

	it('should load a dependency that returns a value instead of a promise', async function () {
		const dm = new DependencyManager();
		const libStub = sinon.stub().returns('instance-value');

		dm.register('foo', libStub);

		await dm.load();

		expect(dm.get('foo')).to.equal('instance-value');
		expect(libStub).to.be.calledWithExactly({});
	});

	it('should load a dependency with a namespace', async function () {
		const dm = new DependencyManager();
		const barStub = sinon.stub().resolves('bar-value');

		dm.register('lib:foo', sinon.stub().resolves('foo-value'));
		dm.register('bar', barStub, ['lib:foo']);

		await dm.load();

		expect(dm.get('lib:foo')).to.equal('foo-value');
		expect(dm.get('bar')).to.equal('bar-value');
		expect(barStub).to.be.calledWithExactly({fooLib: 'foo-value'});
	});

	it('should error if trying to get a dependency before load', async function () {
		const dm = new DependencyManager();
		expect(() => dm.get('foo')).to.throw('Attempt to get dependency before load');
	});

	it('should error if trying to get a dependency that does not exists', async function () {
		const dm = new DependencyManager();
		await dm.load();
		expect(() => dm.get('does-not-exist')).to.throw('does-not-exist is not registered as a dependency');
	});

	it('should error if trying to load a dependency that does not exists', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub(), ['does-not-exist']);
		await expect(dm.load()).to.be.rejectedWith('The dependency, does-not-exist, is not registered. Path: bar');
	});

	it('should error if trying to load a nested dependency that does not exists', async function () {
		const dm = new DependencyManager();
		dm.register('foo1', sinon.stub(), ['foo2']);
		dm.register('foo2', sinon.stub(), ['foo3']);
		dm.register('foo3', sinon.stub(), ['foo4']);
		dm.register('foo4', sinon.stub(), ['foo5']);
		dm.register('foo5', sinon.stub(), ['does-not-exist']);
		await expect(dm.load()).to.be.rejectedWith(
			'The dependency, does-not-exist, is not registered. Path: foo1 > foo2 > foo3 > foo4 > foo5'
		);
	});

	it('should error on cyclic dependency', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub(), ['foo']);
		dm.register('foo', sinon.stub(), ['bar']);
		await expect(dm.load()).to.be.rejectedWith('Cycle detected in dependencies: bar > foo > bar');
	});

	it('should error on adding a alias that conflicts with a dependency', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub());
		expect(() => dm.alias('foo', 'bar')).to.throw(
			'Unable to register alias, bar, because it conflicts with dependency, bar'
		);
	});

	it('should error on adding a alias that conflicts with another alias', async function () {
		const dm = new DependencyManager();
		dm.alias('foo', 'bar');
		expect(() => dm.alias('baz', 'bar')).to.throw(
			'Unable to register alias, bar, because it conflicts with the alias, bar'
		);
	});

	it('should error on adding a constant value that conflicts with a dependency', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub());
		expect(() => dm.set('bar', 'value')).to.throw(
			'Unable to set constant value, bar, because it conflicts with dependency, bar'
		);
	});

	it('should error on adding a constant value that conflicts with an alias', async function () {
		const dm = new DependencyManager();
		dm.alias('foo', 'bar');
		expect(() => dm.set('bar', 'value')).to.throw(
			'Unable to set constant value, bar, because it conflicts with the alias, bar'
		);
	});

	it('should error on adding a dependency that conflicts with another dependency', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub());
		expect(() => dm.register('bar', sinon.stub())).to.throw(
			'Unable to register dependency, bar, because it conflicts with dependency, bar'
		);
	});

	it('should error on adding a dependency that conflicts with an alias', async function () {
		const dm = new DependencyManager();
		dm.alias('foo', 'bar');
		expect(() => dm.register('bar', sinon.stub())).to.throw(
			'Unable to register dependency, bar, because it conflicts with the alias, bar'
		);
	});

	it('should error on adding a dependency that was already registered', async function () {
		const dm = new DependencyManager();
		dm.register('foo', sinon.stub());
		expect(() => dm.register('foo', sinon.stub())).to.throw(
			'Unable to register dependency, foo, because it conflicts with dependency, foo'
		);
	});

	it('should error on adding a alias that was already set', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub());
		dm.alias('bar', 'foo');
		expect(() => dm.alias('bar', 'foo')).to.throw(
			'Unable to register alias, foo, because it conflicts with the alias, foo'
		);
	});

	it('should error on setting a constant that was already set', async function () {
		const dm = new DependencyManager();
		dm.set('bar', 'bar-value');
		expect(() => dm.set('bar', 'bar-new-value')).to.throw(
			'Unable to set constant value, bar, because it conflicts with dependency, bar'
		);
	});

	it('should error on adding a dependency with a similar name that was already registered', async function () {
		const dm = new DependencyManager();
		dm.register('foo-bar', sinon.stub());
		expect(() => dm.register('foo_bar', sinon.stub())).to.throw(
			'Unable to register dependency, foo_bar, because it conflicts with dependency, foo-bar'
		);
	});

	it('should error on adding a alias with a similar name that was already set', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub());
		dm.alias('bar', 'foo-bar');
		expect(() => dm.alias('bar', 'foo_bar')).to.throw(
			'Unable to register alias, foo_bar, because it conflicts with the alias, foo-bar'
		);
	});

	it('should error on setting a constant with a similar name that was already set', async function () {
		const dm = new DependencyManager();
		dm.set('foo-bar', 'bar-value');
		expect(() => dm.set('foo_bar', 'bar-new-value')).to.throw(
			'Unable to set constant value, foo_bar, because it conflicts with dependency, foo-bar'
		);
	});

	it('should error if trying to load itself', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub(), ['bar']);
		await expect(dm.load()).to.be.rejectedWith('Cycle detected in dependencies: bar > bar');
	});

	it('should error if trying to load an alias to itself', async function () {
		const dm = new DependencyManager();
		dm.register('bar', sinon.stub(), ['foo']);
		dm.alias('bar', 'foo');
		await expect(dm.load()).to.be.rejectedWith('Cycle detected in dependencies: bar > foo [bar]');
	});

	it('should error if trying to load with an alias in a dependency cycle', async function () {
		const dm = new DependencyManager();
		dm.register('a', sinon.stub(), ['bb']);
		dm.register('b', sinon.stub(), ['cc']);
		dm.register('c', sinon.stub(), ['aa']);
		dm.alias('a', 'aa');
		dm.alias('b', 'bb');
		dm.alias('c', 'cc');
		await expect(dm.load()).to.be.rejectedWith('Cycle detected in dependencies: a > bb [b] > cc [c] > aa [a]');
	});

	it('should error when adding a dependency with an invalid name', async function () {
		const dm = new DependencyManager();
		expect(() => dm.register('foo{bar', sinon.stub())).to.throw('The name, foo{bar, is not a valid identifier');
	});

	it('should error when adding a namespace with an invalid name', async function () {
		const dm = new DependencyManager();
		expect(() => dm.register('{foo:bar', sinon.stub())).to.throw('The namespace, {foo, is not a valid identifier');
	});
});
