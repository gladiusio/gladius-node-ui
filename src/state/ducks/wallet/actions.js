import { createAction, createApiAction } from '../../../util/createAction';
import { authorizationActions } from '../authorization';
import { signupActions } from '../signup';
import { getJSON, postData, delayed } from '../../../backend';
import {
  SET_PROCESSING_BALANCE,
  SET_WALLET_ADDRESS,
  SET_WALLET_LOADING,
  SET_GLA_BALANCE_LOADING,
  SET_GLA_BALANCE_SUCCESS,
  API_FETCH_BALANCE
} from './types';

const { authorizeUser } = authorizationActions;
const { setWalletSuccess } = signupActions;

export function setWalletAddress(address) {
  return createAction(SET_WALLET_ADDRESS, { address });
}

export function setWalletIsLoading(walletLoading) {
  return createAction(SET_WALLET_LOADING, { walletLoading });
}

export function setGlaBalanceIsLoading(glaBalanceLoading) {
  return createAction(SET_GLA_BALANCE_LOADING, { glaBalanceLoading });
}

export function setGlaBalanceSuccess(glaBalance) {
  return createAction(SET_GLA_BALANCE_SUCCESS, { glaBalance });
}

export function createWallet(passphrase) {
  return async (dispatch) => {
    return await dispatch(createApiAction(API_FETCH_BALANCE, {}, {
      path: '/keystore/account/create',
      method: 'POST',
      body: { passphrase },
    }));
  };
}

export function fetchBalance(walletAddress, balanceType="gla") {
  return async (dispatch) => {
    return await dispatch(createApiAction(API_FETCH_BALANCE, {}, {
      path: `/account/${walletAddress}/balance/${balanceType}`,
      method: 'GET'
    }));
  };
}

export function setProcessingBalance(balance) {
  return createAction(SET_PROCESSING_BALANCE, {
    balance,
  });
}

export function createUserWallet() {
  return async (dispatch, getState) => {
    async function createWalletAndKey(passphrase, email, name) {
      const wallet = await dispatch(createWallet(passphrase));
      if (wallet.error) {
        throw new Error('Wallet creation failed!');
      }
      const walletAddress = wallet.response.address;
      await dispatch(authorizeUser(passphrase));
      dispatch(setWalletAddress(walletAddress));
      dispatch(setWalletSuccess(true));
    }

    const { account } = getState();
    const { email, name, passphraseValue } = account;

    return new Promise(async (resolve, reject) => {
      dispatch(setWalletIsLoading(true));
      try {
        await createWalletAndKey(passphraseValue, email, name);
        dispatch(setWalletIsLoading(false));
        resolve();
      } catch (e) {
        console.log(e);
        dispatch(setWalletIsLoading(false));
        reject();
      }
    });
  };
}

export function fetchGLABalance() {
  return async (dispatch, getState) => {
    async function requestBalance(walletAddress) {
      const request = await dispatch(fetchBalance(walletAddress));
      if (request.error) {
        throw new Error('GLA fetch balance failed!');
      }
      const glaBalance = request.response.value;

      dispatch(setGlaBalanceSuccess(glaBalance));
    }

    const { walletAddress } = getState().wallet;

    dispatch(setGlaBalanceIsLoading(true));
    requestBalance(walletAddress);
    return dispatch(setGlaBalanceIsLoading(false));
  };
}