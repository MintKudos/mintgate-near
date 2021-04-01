import { Near, Contract, keyStores, KeyPair, utils, Account } from 'near-api-js';
import fs from 'fs';
import chalk from 'chalk';
import { homedir } from 'os';
import { basename } from 'path';
import { sha256 } from 'js-sha256';
import bs58 from 'bs58';
import BN from 'bn.js';
import { NearConfig } from 'near-api-js/lib/near';
import { FinalExecutionOutcome } from 'near-api-js/lib/providers';
import { AccountContract, NftContract } from '../src';

const GAS = new BN(300000000000000);

export interface Methods {
    viewMethods: string[],
    changeMethods: string[],
}

export async function createProfiler(contractPrefix: string, wasmPath: string, methods: Methods, init: { func: string, args: any } | null, config: NearConfig, ...userPrefixes: string[]):
    Promise<{
        contractName: string,
        users: AccountContract[]
    }> {
    const out = process.stdout;
    const msg = chalk.blue;
    const ok = chalk.green;
    const param = chalk.cyan;
    const info = (message: string) => out.write(msg(message + ' '));
    const infoln = (message: string) => out.write(chalk.magenta('\u25b6 ') + msg(message) + ok(' \u2713\n'));
    const start = (message: string) => out.write(chalk.magenta('\u25b6 ') + msg(message + '.. '));
    const prog = (message: string) => out.write(msg(message + '.. '));
    const done = () => out.write(ok('\u2713\n'));

    const keyDir = homedir() + '/.near-credentials';
    const keyStore = new keyStores.UnencryptedFileSystemKeyStore(keyDir);
    infoln(`Using key store from ${param(keyDir)}`);

    const near = new Near({
        deps: { keyStore: keyStore },
        ...config
    });

    const getAccountFor = async function (prefix: string) {
        start(`Recovering account for ${param(prefix)}`)
        try {
            const accountId = fs.readFileSync(`neardev/${prefix}-account`).toString();
            const account = await near.account(accountId);
            prog(`found ${param(accountId)}`)
            done();
            return account;
        } catch {
            const generateUniqueAccountId = function () {
                return `${prefix}-${Date.now()}-${Math.round(Math.random() * 1000000)}`;
            }

            const accountId = generateUniqueAccountId();
            prog('creating account');
            const newKeyPair = KeyPair.fromRandom('ed25519');
            const account = await near.createAccount(accountId, newKeyPair.getPublicKey());
            keyStore.setKey(config.networkId, account.accountId, newKeyPair);
            if (!fs.existsSync('neardev')) {
                fs.mkdirSync('neardev');
            }
            fs.writeFileSync(`neardev/${prefix}-account`, accountId);
            done();
            return account;
        }
    }

    const contractAccount = await getAccountFor(contractPrefix);
    const users = await Promise.all(userPrefixes.map(async user => {
        const account = await getAccountFor(user);
        const contract = <NftContract>new Contract(account, contractAccount.accountId, {
            ...methods,
            // signer: account.accountId
        });
        return { account, contract, user };
    }));

    const append = async function (outcome: FinalExecutionOutcome | {}) {
        const getState = async function (account: Account, prefix: string) {
            const state = await account.state();
            const balance = await account.getAccountBalance();

            if (!new BN(balance.total).eq(new BN(balance.stateStaked).add(new BN(balance.available)))) {
                console.log('Total neq staked+available');
            }

            const amountf = (value: string) => chalk.yellow(utils.format.formatNearAmount(value, 4));
            const isContract = state.code_hash == '11111111111111111111111111111111' ? '\u261e' : '\u270e';
            info(`${isContract}${prefix}: Ⓝ S${amountf(balance.stateStaked)}+A${amountf(balance.available)}`);

            return { ...state, ...balance };
        }

        const entry = {
            ...outcome,
            contract: await getState(contractAccount, contractPrefix),
            ...Object.fromEntries(await Promise.all(users.map(async ({ account, contract, user }) => [user, await getState(account, user)]))),
        };
        done();
        return entry;
    };

    start('Initial entry');
    const initialEntry = await append({});

    await (async function () {
        start(`Contract ${chalk.cyan(basename(wasmPath))}`);
        const wasmData = fs.readFileSync(wasmPath);
        const wasmHash = sha256.array(wasmData);
        const wasmBase64 = bs58.encode(Buffer.from(wasmHash));
        info('sha256/base58:' + wasmBase64);
        if (initialEntry.contract.code_hash !== wasmBase64) {
            info('deploying');
            const outcome = await contractAccount.deployContract(wasmData);
            if (init) {
                await contractAccount.functionCall(contractAccount.accountId, init.func, init.args, GAS, new BN(0));
            }

            done();
            await append(outcome);
        } else {
            info('up to date');
            done();
        }
    })();

    return {

        contractName: contractAccount.accountId,

        users: users.map(({ account, contract, user }) => {
            return {
                accountId: account.accountId,
                account,
                contract,
            }
        }),
    };
}