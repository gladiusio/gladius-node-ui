import { createAction, createApiAction } from '../../../util/createAction';
import { getJSON, postData, delayed } from '../../../backend';
import { addToast } from '../toasts/actions';
import {
  SET_EMAIL_ADDRESS,
  SET_EMAIL_ADDRESS_SUCCESS,
  SET_EMAIL_ADDRESS_FAILURE,
  SET_NAME,
  SET_NAME_SUCCESS,
  SET_NAME_FAILURE,
  SET_PASSPHRASE,
  SET_NODE_ADDRESS,
  SET_IP_ADDRESS,
  SET_ACCOUNT_LOADING,
  SET_ACCOUNT_CREATED,
  SET_ACCOUNT_INFO_SAVED,
  SET_APPLY_POOL_LOADING,
  SET_APPLICATION_SUCCESS,
  API_APPLY_TO_POOL,
  API_SET_NODE_DATA,
} from './types';

const mockData = process.env.MOCK_DATA === "true";

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

export function setAccountLoading(accountCreationLoading) {
  return createAction(SET_ACCOUNT_LOADING, { accountCreationLoading });
}

export function setAccountCreated(accountCreated) {
  return createAction(SET_ACCOUNT_CREATED, { accountCreated });
}

export function setAccountInfoSaved(accountInfoSaved) {
  return createAction(SET_ACCOUNT_INFO_SAVED, { accountInfoSaved });
}

export function setNodeAddress(nodeAddress) {
  return createAction(SET_NODE_ADDRESS, { nodeAddress });
}

export function setApplicationLoading(applyPoolLoading) {
  return createAction(SET_APPLY_POOL_LOADING, { applyPoolLoading });
}

export function setApplicationSuccess(poolIds) {
  return createAction(SET_APPLICATION_SUCCESS, { success: true, poolIds });
}

export function setNodeData(nodeAddress, passphrase, body) {
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

export function applyToPool(poolId, body) {
  if (poolId && poolId.trim) {
    poolId = poolId && poolId.trim();
  }

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

export function getNode(walletAddress) {
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
        console.log(e);
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
