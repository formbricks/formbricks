import { h } from 'preact';
import { shallow } from 'enzyme';

import Hello from '../src/component';

describe('Hello logic', () => {
  it('should be able to run tests', () => {
    expect(1 + 2).toEqual(3);
  });
});

describe('Hello Snapshot', () => {
  it('should render header with content', () => {
    const tree = shallow(<Hello />);
    expect(tree.find("h1").text()).toBe('Hello, World!');
  });
});
