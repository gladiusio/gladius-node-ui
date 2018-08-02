import { SubmissionError } from 'redux-form';

import { createAction, nameAction, createApiAction } from '../util/createAction';
import { ErrorState, LoadingState } from '../util/stateValues';
import { getJSON, postData, delayed } from '../backend';
import { addToast } from './toasts';

function wait(delay) {
  return new Promise((resolve, reject) => {
    setTimeout(resolve, delay);
  });
}

async function waitForTransaction(txHash) {
  while (true) {
    let request = await getTransactionStatus(txHash);
    if (request.response.complete && request.response.status) {
      return request;
    }
    await wait(1000);
  }
}

async function getTransactionStatus(txHash) {
  if (mockData) {
    await wait(1000);
    return {
      response: {
        complete: true,
        status: true,
      }
    };
  }
  return getJSON(`${process.env.CONTROL_API}/status/tx/${txHash}`);
}

const namespace = 'account';
const mockData = process.env.MOCK_DATA === "true";

export const SET_EMAIL_ADDRESS = nameAction(namespace, 'SET_EMAIL_ADDRESS');
export const SET_EMAIL_ADDRESS_SUCCESS = nameAction(namespace, 'SET_EMAIL_ADDRESS_SUCCESS');
export const SET_EMAIL_ADDRESS_FAILURE = nameAction(namespace, 'SET_EMAIL_ADDRESS_FAILURE');

export const SET_NAME = nameAction(namespace, 'SET_NAME');
export const SET_NAME_SUCCESS = nameAction(namespace, 'SET_NAME_SUCCESS');
export const SET_NAME_FAILURE = nameAction(namespace, 'SET_NAME_FAILURE');

export const SET_PASSPHRASE = nameAction(namespace, 'SET_PASSPHRASE');
export const SET_NODE_ADDRESS = nameAction(namespace, 'SET_NODE_ADDRESS');
export const SET_IP_ADDRESS = nameAction(namespace, 'SET_IP_ADDRESS');

const SET_ACCOUNT_LOADING = nameAction(namespace, 'SET_ACCOUNT_LOADING');
const SET_ACCOUNT_CREATED = nameAction(namespace, 'SET_ACCOUNT_CREATED');
const SET_ACCOUNT_INFO_SAVED = nameAction(namespace, 'SET_ACCOUNT_INFO_SAVED');

const SET_APPLY_POOL_LOADING = nameAction(namespace, 'SET_APPLY_POOL_LOADING');
const SET_APPLICATION_SUCCESS = nameAction(namespace, 'SET_APPLICATION_SUCCESS');

const API_APPLY_TO_POOL = nameAction(namespace, 'API_APPLY_TO_POOL');
const API_SET_NODE_DATA = nameAction(namespace, 'API_SET_NODE_DATA');

export function setEmailAddressFailure(error) {
  return createAction(SET_EMAIL_ADDRESS_FAILURE, null, error);
}

export function setEmailAddressSuccess(email) {
  return createAction(SET_EMAIL_ADDRESS_SUCCESS, { email });
}

export function setNameFailure(error) {
  return createAction(SET_NAME_FAILURE, null, error);
}

export function setNameSuccess(name) {
  return createAction(SET_NAME_SUCCESS, { name });
}

export function setEmailAddressAndName(email, name) {
  return async (dispatch) => {
    if (email.indexOf('@') > 1) {
      dispatch(setEmailAddressSuccess(email));
    } else {
      dispatch(setEmailAddressFailure(new Error('Email is invalid')));
    }

    if (name) {
      dispatch(setNameSuccess(name));
    } else {
      dispatch(setNameFailure(new Error('Name is invalid')));
    }
  };
}

export function setPassphrase(passphrase) {
  return createAction(SET_PASSPHRASE, passphrase);
}

export function setIPAddress(ipData) {
  return createAction(SET_IP_ADDRESS, { ip: ipData.ip });
}

export function validatePassphrase({passphraseValue, passphraseConfirmation}) {
  return passphraseValue && passphraseValue.length > 0 &&
    passphraseConfirmation && passphraseConfirmation.length > 0 &&
    passphraseValue === passphraseConfirmation;
}

function setAccountLoading(accountCreationLoading) {
  return createAction(SET_ACCOUNT_LOADING, { accountCreationLoading });
}

function setAccountCreated(accountCreated) {
  return createAction(SET_ACCOUNT_CREATED, { accountCreated });
}

function setAccountInfoSaved(accountInfoSaved) {
  return createAction(SET_ACCOUNT_INFO_SAVED, { accountInfoSaved });
}

function setNodeAddress(nodeAddress) {
  return createAction(SET_NODE_ADDRESS, { nodeAddress });
}

function setApplicationLoading(applyPoolLoading) {
  return createAction(SET_APPLY_POOL_LOADING, { applyPoolLoading });
}

function setApplicationSuccess(poolIds) {
  return createAction(SET_APPLICATION_SUCCESS, { success: true, poolIds });
}

function createNode(passphrase) {
  if (mockData) {
    return delayed(() => {
      return {
        txHash: { value: '0x8392141904' },
      };
    }, 3000);
  }

  return postData(
    `${process.env.CONTROL_API}/node/create`,
    {},
    { 'X-Authorization': passphrase }
  );
}

function setNodeData(nodeAddress, passphrase, body) {
  if (mockData) {
    return delayed(() => {
      return {
        txHash: { value: '0x3012093812038' },
      };
    }, 3000);
  }

  return async (dispatch) => {
    return await dispatch(createApiAction(API_SET_NODE_DATA, {}, {
      path: `/node/${nodeAddress}/data`,
      method: 'POST',
      body,
      headers: { 'X-Authorization': passphrase },
    }));
  };
}

function applyToPool(poolId, body) {
  if (mockData) {
    return delayed(() => {
      return {
        txHash: {
          value: '0x92312312',
        },
        success: true,
      };
    }, 3000);
  }

  return async (dispatch) => {
    return await dispatch(createApiAction(API_APPLY_TO_POOL, {}, {
      path: `/node/applications/${poolId}/new`,
      method: 'POST',
      body,
    }));
  };
}

function getNode(walletAddress) {
  if (mockData) {
    return delayed(() => {
      return {
        response: {address: 'mynodeaddress'}
      };
    });
  }
  return getJSON(`${process.env.CONTROL_API}/node/`);
}

export function createApplications(poolIds) {
  return async (dispatch, getState) => {
    const { account, expectedUsage } = getState();
    const {
      email,
      name
    } = account;
    const {
      reason,
      estimatedSpeed,
    } = expectedUsage;

    async function applyToPools(poolIds) {
      for(var i = 0; i < poolIds.length; i++) {
        let application;
        try {
          application = await dispatch(applyToPool(
            poolIds[i],
            {
              email,
              name,
              reason,
              estimatedSpeed,
            }
          ));
        } catch(e) {
          throw new Error(e);
        }

        if (application && application.error) {
          return application;
        }
      }
    }

    return new Promise(async (resolve, reject) => {
      dispatch(setApplicationLoading(true));

      try {
        const application = await applyToPools(poolIds);
        dispatch(setApplicationLoading(false));
        if (application && application.error) {
          return reject();
        }

        dispatch(addToast({
          text: 'You have successfully applied to a pool!',
          success: true,
        }));
        dispatch(setApplicationSuccess(poolIds));
        resolve();
      } catch (e) {
        dispatch(setApplicationLoading(false));
        reject();
      }
    });
  }
}

export function setUserNodeData() {
  return async (dispatch, getState) => {
    const { account, expectedUsage, wallet } = getState();
    const { email, name, passphraseValue, nodeAddress, ip } = account;
    const { walletAddress } = wallet;
    const {
      storageAmount,
      estimatedSpeed,
      reason,
      uptimeStart,
      uptimeEnd,
      allDayUptime,
    } = expectedUsage;

    return new Promise(async (resolve, reject) => {
      const setNode = await dispatch(setNodeData(nodeAddress, passphraseValue, {
        name,
        email,
        passphrase: passphraseValue,
        storageAmount,
        estimatedSpeed,
        reason,
        uptimeStart,
        uptimeEnd,
        allDayUptime,
        ip,
      }));

      if (setNode.error) {
        return reject();
      }

      await waitForTransaction(setNode.txHash.value);
      resolve();
    });
  }
}

export function getNodeInfo() {
  return async (dispatch, getState) => {
    const { walletAddress } = getState().wallet;
    const nodeRequest = await getNode(walletAddress);

    return new Promise((resolve, reject) => {
      if (nodeRequest.error) {
        reject(nodeRequest.error);
      }

      const nodeAddress = nodeRequest.response.address;
      const nodeData = nodeRequest.response.data;
      if (nodeData) {
        if (nodeData.email && nodeData.name) {
          dispatch(setAccountCreated(true));
          dispatch(setEmailAddressAndName(nodeData.email, nodeData.name));
        }

        if (nodeData.ip) {
          dispatch(setIPAddress(nodeData.ip));
        }
      }
      dispatch(setNodeAddress(nodeAddress));
      resolve(nodeAddress);
    })
  }
}

export function createAccount() {
  return async (dispatch, getState) => {
    let accountCreationFailure = false;
    dispatch(setAccountLoading(true));

    async function createUserNode() {
      const { account, wallet } = getState();
      const { passphraseValue } = account;
      const { walletAddress } = wallet;

      if (!account.accountCreated) {
        const nodeCreation = await createNode(passphraseValue);
        if (nodeCreation.error) {
          throw new Error('Node creation failed!');
        }

        await waitForTransaction(nodeCreation.txHash.value);
        dispatch(setAccountCreated(true));
      }

      return dispatch(getNodeInfo()).then(() => {
        return dispatch(setUserNodeData()).then(() => {
          dispatch(setAccountInfoSaved(true));
        });
      }, () => {
        accountCreationFailure = true;
      });
    }

    try {
      await createUserNode();
    } catch(e) {
      accountCreationFailure = true;
    }
    dispatch(setAccountLoading(false));

    return new Promise((resolve, error) => {
      if (accountCreationFailure) {
        error(getState().account.accountCreated);
      } else {
        resolve();
      }
    });
  }
}

export default function reducer(state = {}, action = {}) {
  switch (action.type) {
    case SET_EMAIL_ADDRESS:
      return {
        ...state,
        email: new LoadingState(state.email),
      };
    case SET_EMAIL_ADDRESS_SUCCESS:
      return {
        ...state,
        email: action.payload.email,
      };
    case SET_EMAIL_ADDRESS_FAILURE:
      return {
        ...state,
        email: new ErrorState(action.error),
      };
    case SET_NAME:
      return {
        ...state,
        name: new LoadingState(state.name),
      };
    case SET_NAME_SUCCESS:
      return {
        ...state,
        name: action.payload.name,
      };
    case SET_NAME_FAILURE:
      return {
        ...state,
        name: new ErrorState(action.error),
      };
    case SET_PASSPHRASE:
      return {
        ...state,
        passphraseValue: action.payload.passphraseValue,
      };
    case SET_NODE_ADDRESS:
      return {
        ...state,
        nodeAddress: action.payload.nodeAddress,
      };
    case SET_IP_ADDRESS:
      return {
        ...state,
        ip: action.payload.ip,
      };
    case SET_ACCOUNT_LOADING:
      return {
        ...state,
        accountCreationLoading: action.payload.accountCreationLoading,
      };
    case SET_ACCOUNT_CREATED:
      return {
        ...state,
        accountCreated: action.payload.accountCreated,
      };
    case SET_ACCOUNT_INFO_SAVED:
      return {
        ...state,
        accountInfoSaved: action.payload.accountInfoSaved,
      };
    case SET_APPLY_POOL_LOADING:
      return {
        ...state,
        applyPoolLoading: action.payload.applyPoolLoading,
      };
    case SET_APPLICATION_SUCCESS:
      return {
        ...state,
        appliedToPool: action.payload.success,
      };
    default:
      return state;
  }
}
