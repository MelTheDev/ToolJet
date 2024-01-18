import { shallow } from 'zustand/shallow';
import { create, zustandDevTools } from './utils';
import { omit } from 'lodash';
import { useResolveStore } from './resolverStore';

const initialState = {
  queries: {},
  components: {},
  globals: {
    theme: { name: 'light' },
    urlparams: null,
  },
  errors: {},
  variables: {},
  client: {},
  server: {},
  page: {
    handle: '',
    variables: {},
  },
  succededQuery: {},
};

export const useCurrentStateStore = create(
  zustandDevTools(
    (set, get) => ({
      ...initialState,
      actions: {
        setCurrentState: (currentState) => {
          set({ ...currentState }, false, { type: 'SET_CURRENT_STATE', currentState });
        },
        setErrors: (error) => {
          set({ errors: { ...get().errors, ...error } }, false, { type: 'SET_ERRORS', error });
        },
      },
    }),
    { name: 'Current State' }
  )
);

export const useCurrentState = () =>
  // Omitting 'actions' here because we don't want to expose it to user
  useCurrentStateStore((state) => {
    return {
      queries: state.queries,
      components: state.components,
      globals: state.globals,
      errors: state.errors,
      variables: state.variables,
      client: state.client,
      server: state.server,
      page: state.page,
      succededQuery: state.succededQuery,
      constants: state.constants,
      layout: state.layout,
    };
  }, shallow);

useCurrentStateStore.subscribe(
  (state) => {
    // This function is called whenever the state changes.
    // You can access the updated state and perform actions in another store.
    useResolveStore.getState().actions.updateAppSuggestions(state);
  },
  (state) => [state] // Specify the part of the state to listen for changes
);

export const getCurrentState = () => {
  return omit(useCurrentStateStore.getState(), 'actions');
};
