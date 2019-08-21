import React from 'react';
import PropTypes from 'prop-types';

import get from 'lodash/get.js';
import set from 'lodash/set.js';
import cloneDeep from 'lodash/cloneDeep.js';
import pullAt from 'lodash/pullAt.js';
import uniqueId from 'lodash/uniqueId.js';

import { useForceUpdate } from './use-force-update.js';

const FormContext = React.createContext();

// Returns an array of all keys/paths of an object (including nested objects/arrays)
const keyify = (obj, prefix = '') =>
  Object.keys(obj).reduce((res, el) => {
    if (Array.isArray(obj[el]) && obj[el].length) {
      obj[el].forEach((nestedObj, nestedObjIndex) => [
        ...res,
        ...keyify(nestedObj, `${prefix}[${nestedObjIndex}].`)
      ]);
    }
    if (typeof obj[el] === 'object' && obj[el] !== null) {
      return [...res, ...keyify(obj[el], `${prefix}${el}.`)];
    }
    return [...res, prefix + el];
  }, []);

// Helper function for pushing functions into path
const push = (container, path, functionToAdd) => {
  // eslint-disable-next-line no-param-reassign
  container[path] = container[path] || [];
  container[path].push(functionToAdd);
};

// Helper function for removing functions from path
const remove = (container, path, functionToRemove) => {
  // eslint-disable-next-line no-param-reassign
  container[path] = (container[path] || []).filter(
    func => func !== functionToRemove
  );
};

export const FormProvider = props => {
  const { initValue, validate: contextValidator } = props;

  // holds a copy of init form values in case you want to reset to original values
  const initState = React.useRef(cloneDeep(initValue));

  const formValue = React.useRef(cloneDeep(initValue));
  const formDirty = React.useRef({});
  const formError = React.useRef({});

  // Used for generating a unique Id for each for item (needed for arrays)
  const formUniqueIds = React.useRef({});

  // Local validators
  const localValidators = React.useRef({});

  // Form Validity
  const formValid = React.useRef(true);
  const invalidPathSet = React.useRef(new Set());

  // Handling force updates
  const forceUpdates = React.useRef([]);

  // Hnadling force updates by path
  const forceUpdatesByPath = React.useRef({});

  // Helper methods to get form ref values
  const getFormValues = path =>
    path ? get(formValue.current, path, '') : formValue.current;
  const getFormDirty = path =>
    path ? get(formDirty.current, path, '') : formDirty.current;
  const getFormError = path =>
    path ? get(formError.current, path, false) : formError.current;

  const getFormValid = () => formValid.current;

  const setFormDirty = (path, value) => set(formDirty.current, path, value);
  const setFormError = (path, value) => set(formError.current, path, value);

  // Validates the `path / value`  with local form item validators
  // and updates the formError.current with error message
  const runLocalValidators = (path, value) => {
    const errorMessage = get(localValidators.current, path, []).reduce(
      (acc, validator) => acc || validator(value),
      ''
    );

    setFormError(path, errorMessage);
  };

  // Set context form values, runs local validators, runs context validator
  const setFormValue = (path, value) => {
    set(formValue.current, path, value);

    runLocalValidators(path, value);

    if (contextValidator) {
      const errorObject = contextValidator(
        formValue.current,
        formError.current
      );

      keyify(errorObject).forEach(errorPath => {
        const newErrorMessage = get(errorObject, errorPath);
        invalidPathSet.current.add(path);
        setFormError(errorPath, newErrorMessage);
      });
    }

    const errorMessage = get(formError.current, path);

    // container that keeps track of the invalid fields,
    if (errorMessage) {
      invalidPathSet.current.add(path);
    } else {
      invalidPathSet.current.delete(path);
    }

    // Update global validity with new valid state
    formValid.current = !invalidPathSet.current.size;

    // Trigger force updates in array
    forceUpdates.current.forEach(forceUpdate => forceUpdate());

    // Trigger force update in path
    (forceUpdatesByPath.current[path] || []).forEach(forceUpdate =>
      forceUpdate()
    );
  };

  const subscribe = ({ path, validate }) => {
    if (Array.isArray(validate) && validate.length) {
      validate.forEach(validateFunction => {
        if (typeof validateFunction === 'function') {
          push(localValidators.current, path, validateFunction);
        } else {
          throw new Error(`Path: ${path}, has invalid validate function`);
        }
      });
    }

    if (validate && typeof validate === 'function') {
      push(localValidators.current, path, validate);
    }

    // Intializing the context form data if paths don't already exist
    // Note, setFormValue() will run context and local validation on path/value
    setFormValue(path, getFormValues(path));
    setFormDirty(path, getFormDirty(path));
    setFormError(path, getFormError(path));

    return () => {
      if (Array.isArray(validate) && validate.length) {
        validate.forEach(validateFunction => {
          remove(localValidators.current, path, validateFunction);
        });
      } else {
        remove(localValidators.current, path, validate);
      }
    };
  };

  // Helper function setting all form dirty states
  const setAllFormDirty = boolean => {
    keyify(formDirty.current).forEach(path => {
      setFormDirty(path, boolean);
      (forceUpdatesByPath.current[path] || []).forEach(forceUpdate =>
        forceUpdate()
      );
    });
  };

  // Setting anew initial state for form
  const initialize = (
    newFormState,
    replaceInitState = true,
    { keepDirty = false }
  ) => {
    if (replaceInitState) {
      initState.current = cloneDeep(newFormState);
    }

    keyify(newFormState).forEach(path => {
      setFormValue(path, get(newFormState, path));
    });

    if (!keepDirty) {
      setAllFormDirty(false);
    }
  };

  // set all dirty values to false
  // set to original init values back, and runs all validators
  const reset = () =>
    initialize(initState.current, false, { keepDirty: false });

  // Dirtify all form items
  // Validation should already be up to date
  const submit = () => {
    setAllFormDirty(true);
    return {
      valid: getFormValid(),
      values: getFormValues(),
      errors: getFormError()
    };
  };

  const arrayPush = (path, value = null) => {
    const currentValue = get(formValue.current, path);
    const currentArrayLength = Array.isArray(currentValue)
      ? currentValue.length
      : 0;

    if (value) {
      setFormValue(`${path}[${currentArrayLength}]`, value);
    }

    (forceUpdatesByPath.current[path] || []).forEach(forceUpdate =>
      forceUpdate()
    );
  };

  const arrayRemove = (path, index) => {
    const currentValue = get(formValue.current, path);

    if (!Array.isArray(currentValue)) {
      throw new Error('You are not removing from an array: %s', path);
    }

    // Probably should not mutate original array but... this is so much cleaner
    [formValue, formError, formDirty, formUniqueIds].forEach(
      ({ current: container }) => {
        const array = get(container, path);
        pullAt(array, index);
      }
    );

    (forceUpdatesByPath.current[path] || []).forEach(forceUpdate =>
      forceUpdate()
    );
  };

  const subscribeForceUpdate = (path = '', forceUpdate) => {
    if (path) {
      push(forceUpdatesByPath.current, path, forceUpdate);
    } else {
      forceUpdates.current.push(forceUpdate);
    }

    return () => {
      if (path) {
        remove(forceUpdatesByPath.current, path, forceUpdate);
      } else {
        forceUpdates.current = forceUpdates.current.filter(
          func => func !== forceUpdate
        );
      }
    };
  };

  const getFormItemUniqueId = path => {
    if (get(formUniqueIds.current, path))
      return get(formUniqueIds.current, path);
    const id = uniqueId('formItem_');
    set(formUniqueIds.current, path, id);
    return id;
  };

  const log = () => {
    console.log('formValues', formValue.current);
    console.log('dirty', formDirty.current);
    console.log('error', formError.current);
    console.log('form valid', formValid.current);
    console.log('form unique ids', formUniqueIds.current);
  };

  const context = {
    log,

    getFormValues,
    getFormDirty,
    getFormError,
    getFormValid,
    getFormItemUniqueId,

    updateValue: setFormValue,
    updateDirty: setFormDirty,
    initialize,

    reset,
    submit,

    arrayPush,
    arrayRemove,

    // These should NOT be used outside of this file
    subscribe,
    subscribeForceUpdate
  };

  return <FormContext.Provider value={context} {...props} />;
};

FormProvider.propTypes = {
  initValue: PropTypes.shape({}),
  validate: PropTypes.func
};

FormProvider.defaultProps = {
  initValue: {},
  validate: null
};

const useFormContext = () => {
  const context = React.useContext(FormContext);

  if (!context) {
    throw new Error('useFormContext() must be used within a FormProvider');
  }

  return context;
};

const usePathForceUpdate = ({ path = '' }) => {
  const { subscribeForceUpdate } = useFormContext();
  const forceUpdate = useForceUpdate();

  // Important that forceUpdate is not a dependency
  // cause it would cause infinite re-renders
  React.useEffect(() => subscribeForceUpdate(path, forceUpdate), [
    path,
    subscribeForceUpdate
  ]);
};

// Needed for dynamic form validators in form items
// since validate is a dependency for subscribe
const defaultValidator = () => '';

export const useFormItem = ({ path, validate = defaultValidator }) => {
  const {
    getFormValues,
    getFormDirty,
    getFormError,
    subscribe,
    updateValue,
    updateDirty
  } = useFormContext();

  usePathForceUpdate({ path });

  React.useEffect(() => subscribe({ path, validate }), [
    path,
    validate,
    subscribe
  ]);

  const error = getFormError(path);

  const setLocalState = newValue => {
    updateDirty(path, true);
    updateValue(path, newValue);
  };

  return {
    value: getFormValues(path),
    update: setLocalState,
    valid: Boolean(!error),
    dirty: getFormDirty(path),
    error: getFormError(path)
  };
};

export const useFormArrayLength = ({ path }) => {
  const {
    getFormValues,
    getFormItemUniqueId,
    arrayPush,
    arrayRemove
  } = useFormContext();

  usePathForceUpdate({ path });

  const extra = {
    getValue: () => getFormValues(path),
    arrayPush,
    arrayRemove,
    getFormItemUniqueId
  };

  const currentValue = getFormValues(path);
  const arrayLength = Array.isArray(currentValue) ? currentValue.length : 0;

  return [arrayLength, extra];
};

export const useFormValues = (props = { path: '' }) => {
  usePathForceUpdate({ path: props.path });
  return useFormContext().getFormValues(props.path);
};

export const useFormError = (props = { path: '' }) => {
  usePathForceUpdate({ path: props.path });
  return useFormContext().getFormError(props.path);
};

export const useFormValid = (props = { path: '' }) => {
  usePathForceUpdate({ path: props.path });
  return useFormContext().getFormValid(props.path);
};

export const useFormHelpers = () => useFormContext();
