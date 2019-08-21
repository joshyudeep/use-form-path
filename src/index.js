import React from 'react';
import ReactDOM from 'react-dom';

import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';

import './styles.css';
import {
  FormProvider,
  useFormItem,
  useFormValues,
  useFormHelpers
} from './use-form-path.jsx';

const initValue = {
  username: '123',
  password: '123'
};

const Fields = () => {
  const username = useFormItem({ path: 'username' });
  const password = useFormItem({ path: 'password' });
  console.log('Fields render');
  return (
    <React.Fragment>
      <div>
        <TextField
          label="Username"
          margin="dense"
          variant="outlined"
          value={username.value}
          onChange={e => username.update(e.target.value)}
        />
      </div>
      <div>
        <TextField
          label="Password"
          margin="dense"
          variant="outlined"
          value={password.value}
          onChange={e => password.update(e.target.value)}
        />
      </div>
    </React.Fragment>
  );
};

const Values = () => {
  const values = useFormValues();
  return <pre>{JSON.stringify(values, 0, 2)}</pre>;
};

const Log = () => {
  const { log } = useFormHelpers();
  return (
    <Button variant="contained" onClick={log}>
      Log
    </Button>
  );
};

function App() {
  return (
    <FormProvider initValue={initValue}>
      <div className="App">
        <h1>use-form-path.jsx</h1>
        <Fields />
        <Values />
        <Log />
      </div>
    </FormProvider>
  );
}

const rootElement = document.getElementById('root');
ReactDOM.render(<App />, rootElement);
