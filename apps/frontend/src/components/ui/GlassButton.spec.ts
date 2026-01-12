import { mount } from '@vue/test-utils';
import { describe, it, expect } from 'vitest';
import GlassButton from './GlassButton.vue';

describe('GlassButton', () => {
  it('renders slot content', () => {
    const wrapper = mount(GlassButton, {
      slots: {
        default: 'Click Me',
      },
    });
    expect(wrapper.text()).toContain('Click Me');
  });

  it('applies variant class', () => {
    const wrapper = mount(GlassButton, {
      props: {
        variant: 'neon',
      },
    });
    expect(wrapper.classes()).toContain('neon');
  });

  it('applies full-width class when prop is set', () => {
    const wrapper = mount(GlassButton, {
      props: {
        fullWidth: true,
      },
    });
    expect(wrapper.classes()).toContain('full-width');
  });

  it('is disabled when disabled prop is true', () => {
    const wrapper = mount(GlassButton, {
      props: {
        disabled: true,
      },
    });
    expect(wrapper.attributes('disabled')).toBeDefined();
  });
});
