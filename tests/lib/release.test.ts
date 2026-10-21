import { nextVersion, withVersion } from '../../scripts/release';

test('a release raises the last number by default, and resets the smaller ones on bigger steps', () => {
  expect(nextVersion('1.0.0', 'patch')).toBe('1.0.1');
  expect(nextVersion('1.0.9', 'patch')).toBe('1.0.10');
  expect(nextVersion('1.4.2', 'minor')).toBe('1.5.0');
  expect(nextVersion('1.4.2', 'major')).toBe('2.0.0');
});

test('a version that is not x.y.z stops the release instead of guessing', () => {
  expect(() => nextVersion('1.0', 'patch')).toThrow('1.2.3');
});

test('only the app version line changes in app.json, not formatting or other versions', () => {
  const before = '{\n  "expo": {\n    "name": "MinNabo",\n    "version": "1.0.0",\n    "plugins": [["x", { "minVersion": "1.0.0" }]]\n  }\n}\n';
  expect(withVersion(before, '1.0.0', '1.0.1')).toBe(before.replace('"version": "1.0.0"', '"version": "1.0.1"'));
});

test('an app.json with the version zero or several times is refused', () => {
  expect(() => withVersion('{"expo": {}}', '1.0.0', '1.0.1')).toThrow('found it 0 times');
  expect(() => withVersion('{"version": "1.0.0", "a": {"version": "1.0.0"}}', '1.0.0', '1.0.1')).toThrow('found it 2 times');
});
