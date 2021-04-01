import { Request, Response } from 'express';

export default interface Component {
	/**
	 * Execute the process
	 *
	 * @param {Request} req - Request
	 * @param {Response} res - Response
	 */
	execute(req: Request, res: Response): Promise<void>;
}
