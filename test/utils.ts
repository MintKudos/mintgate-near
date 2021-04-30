import util from 'util';

import BN from 'bn.js';
import { customAlphabet } from 'nanoid/async';
import chalk from 'chalk';

import type { Fraction, NftContract } from '../src';

const gateIdNanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

export const generateGateId = async (): Promise<string> => gateIdNanoid();

const collectibleDefaultData = {
  title: 'A'.repeat(140),
  description: 'D'.repeat(1024),
  supply: 100,
  royalty: {
    num: 3,
    den: 10,
  },
  media: 'M'.repeat(1024),
  media_hash: 'MH'.repeat(1024 / 2),
  reference: 'R'.repeat(1024),
  reference_hash: 'RH'.repeat(1024 / 2),
};

export const addTestCollectible = async (
  contract: NftContract,
  collectibleData: {
    gate_id?: string;
    title?: string;
    description?: string;
    supply?: number;
    royalty?: Fraction;
    media?: string;
    media_hash?: string;
    reference?: string;
    reference_hash?: string;
  } = {}
): Promise<void> => {
  let { gate_id } = collectibleData;

  if (gate_id === undefined) {
    gate_id = await generateGateId();
  }

  return contract.create_collectible({
    ...collectibleDefaultData,
    ...collectibleData,
    gate_id,
  });
};

export const formatNsToMs = (timestampNs: number): number =>
  Number(
    (() => {
      let timestampStr = timestampNs.toString();

      if (timestampStr.length > 13) {
        return timestampStr.slice(0, 13);
      }

      if (timestampStr.length < 13) {
        for (let i = timestampStr.length; i < 13; i += 1) {
          timestampStr += '0';
        }

        return timestampStr;
      }

      return timestampStr;
    })()
  );

export const isWithinLastMs = (timestamp: number, ms: number): boolean => timestamp > Date.now() - ms;

export const logger = {
  out: process.stdout,

  msg: chalk.blue,
  ok: chalk.green,
  param: chalk.cyan,
  warn: chalk.yellow,

  prog(message: string): void {
    this.out.write(this.msg(`${message}.. `));
  },

  info(message: string): void {
    logger.out.write(logger.msg(`${message} `));
  },

  infoln(message: string): void {
    this.out.write(chalk.magenta('\u25b6 ') + this.msg(message) + this.ok(' \u2713\n'));
  },

  title(message: string): void {
    this.out.write(`\n${chalk.inverse(message)}\n\n`);
  },

  data(message: string, data?: unknown): void {
    this.out.write(`\n${chalk.blue.underline(message)}: `);
    if (data !== undefined) {
      this.out.write(
        `${util.inspect(data, {
          colors: true,
          depth: null,
        })}\n\n`
      );
    } else {
      this.out.write('\n\n');
    }
  },

  start(message: string): void {
    this.out.write(chalk.magenta('\u25b6 ') + this.msg(`${message}.. `));
  },

  done(): void {
    this.out.write(this.ok('\u2713\n'));
  },
};

export const getShare = (totalAmount: number, { num, den }: Fraction): number => (totalAmount * num) / den;

export const validGateIdRegEx = /^[a-z\d_-]{1,32}$/gi;

export const MAX_GAS_ALLOWED = new BN(300000000000000);
