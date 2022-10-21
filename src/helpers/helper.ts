import { validationResult } from "express-validator"
import { Request, Response } from "express"

export const isValidated = (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() })
    } else {
        return true
    }
}