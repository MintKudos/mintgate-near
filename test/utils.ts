import util from 'util';

import { customAlphabet } from 'nanoid/async';
import chalk from 'chalk';

import type { Fraction, NftContract } from '../src';

const nanoid = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 12);

export const generateId = async (): Promise<string> => nanoid();

const collectibleDefaultData = {
  gate_url: 'Test gate url',
  title: 'Test title',
  description: 'Test description',
  supply: '100',
  royalty: {
    num: 3,
    den: 10,
  },
};

export const addTestCollectible = async (
  contract: NftContract,
  collectibleData: {
    gate_id?: string;
    gate_url?: string;
    title?: string;
    description?: string;
    supply?: string;
    royalty?: Fraction;
  } = {}
): Promise<void> => {
  let { gate_id } = collectibleData;

  if (!gate_id) {
    gate_id = await generateId();
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
      this.out.write(`${util.inspect(data, { colors: true, depth: null })}\n\n`);
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
