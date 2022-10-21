import { PrismaClient, Prisma } from '@prisma/client';
import bodyParser from 'body-parser';
import express from 'express';
import { Request, Response } from 'express';
import { body, param } from 'express-validator';

import { isValidated } from './helpers/helper';

const app = express()
app.use(bodyParser.json())

const prisma = new PrismaClient()

// #region User
// get users
app.get('/users',
    async (req: Request, res: Response) => {
        try {
            const users = await prisma.user.findMany({
                include: {
                    borrows: true
                }
            })

            if (users.length == 0) {
                res.status(200).json({ message: 'No data' })
            } else {
                res.status(200).json(users)
            }
        } catch (error) {
            res.status(500).json(error)
        }
    })

// get user with id
app.get('/users/:id',
    async (req: Request, res: Response) => {
        try {
            const userId = req.params.id
            const user = await prisma.user.findUnique({
                include: {
                    borrows: true
                },
                where: {
                    id: +userId
                }
            })

            if (user) {
                res.status(200).json(user)
            } else {
                res.status(200).json({ message: `User not found with id:${userId}` })
            }


        } catch (error) {
            res.status(500).json(error)
        }
    })

// create user with validated data
app.post('/users',
    body('email').isEmail().withMessage('Email is incorrect.'),
    body('email').custom(async (value) => {

        const user = await prisma.user.findUnique(
            {
                where: {
                    email: value
                }
            }
        )

        if (user) {
            return Promise.reject('Email already in use.')
        }
    }),
    body('name').notEmpty().withMessage('Name cannot be empty.'),
    async (req: Request, res: Response) => {
        if (isValidated(req, res)) {
            try {
                const newUser = await prisma.user.create({
                    data: req.body
                })

                res.status(201).json({ user: newUser })
            } catch (error) {
                res.status(500).json(error)
            }
        }

    })
// #endregion


// #region Book
// get books
app.get('/books',
    async (req: Request, res: Response) => {
        try {
            const books = await prisma.book.findMany(
                {
                    include: {
                        borrow: true
                    }
                }
            )

            res.status(200).send(books)
        } catch (error) {
            res.status(500).json(error)
        }
    })

// get book with id
app.get('/books/:id',
    async (req: Request, res: Response) => {
        try {
            const bookId = req.params.id
            const book = await prisma.book.findUnique({
                include: {
                    borrow: true
                },
                where: {
                    id: +bookId
                }
            })

            res.status(200).send(book)
        } catch (error) {
            res.status(500).json(error)
        }
    })

// create book
app.post('/books',
    async (req: Request, res: Response) => {
        try {
            const book = await prisma.book.create({
                data: req.body
            })

            res.status(201).send(book)
        } catch (error) {
            res.status(500).json(error)
        }
    })
// #endregion


// #region Borrow

// debug endpoint no need that
// app.get('/borrow',
//     async (req: Request, res: Response) => {
//         try {
//             const borrows = await prisma.borrow.findMany()

//             if (borrows.length == 0) {
//                 res.status(200).json({ message: 'No data' })
//             } else {
//                 res.status(200).json(borrows)
//             }
//         } catch (error) {
//             res.status(500).json(error)
//         }
//     })


// borrow book with user
// every book borrowing from single user
app.post('/users/:userId/borrow/:bookId',
    param('userId').custom(async (userId) => {
        const user = await prisma.user.findUnique({
            where: {
                id: +userId
            }
        })

        if (!user) {
            throw Promise.reject(`There is no user with that id: ${userId}. You cannot take action.`)
        }
    }),
    param('bookId').custom(async (bookId) => {
        const book = await prisma.book.findUnique({
            where: {
                id: +bookId
            }
        })

        if (!book) {
            throw Promise.reject(`There is no book with that id: ${bookId}. You cannot take action.`)
        }
    }),
    async (req: Request, res: Response) => {
        try {
            const userId = req.params.userId
            const bookId = req.params.bookId

            const borrow = await prisma.borrow.create({
                data: {
                    borrowedUserId: +userId,
                    borrowedBookId: +bookId
                }
            })

            await prisma.book.update(
                {
                    where: {
                        id: +bookId
                    },
                    data: {
                        borrowedCount: {
                            increment: 1
                        }
                    }
                }
            )

            res.status(201).json(borrow)
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError) {
                if (error.code === 'P2002') {
                    res.status(500).json('There is a unique constraint violation, You cannot borrow already borrowed book.')
                }
            } else {
                res.status(500).json(error)
            }
        }

    })


// return book
// rate the book
app.post('/users/:userId/return/:bookId',
    param('userId').custom(async (userId) => {
        const user = await prisma.user.findUnique({
            where: {
                id: +userId
            }
        })

        if (!user) {
            throw Promise.reject(`There is no user with that id: ${userId}. You cannot take action.`)
        }
    }),
    param('bookId').custom(async (bookId) => {
        const book = await prisma.book.findUnique({
            where: {
                id: +bookId
            }
        })

        if (!book) {
            throw Promise.reject(`There is no book with that id: ${bookId}. You cannot take action.`)
        }
    }),
    body('score').notEmpty().withMessage('Score cannot be blank.'),
    body('score').isInt({ min: 1, max: 10 }).withMessage('Score must be 1-10.'),
    async (req: Request, res: Response) => {
        if (isValidated(req, res)) {
            try {

                const score = req.body.score
                const bookId = +req.params.bookId
                const book = await prisma.book.findUnique(
                    {
                        where: {
                            id: bookId
                        }
                    }
                )

                const borrow = await prisma.borrow.findUnique({
                    where: {
                        borrowedBookId: bookId
                    }
                })

                if (!borrow) {
                    res.status(200).json({ message: `There is no borrowed book with that id: ${bookId}` })
                }

                await prisma.borrow.delete({
                    where: {
                        id: borrow!.id
                    }
                })

                await prisma.book.update(
                    {
                        where: {
                            id: book!.id
                        },
                        data: {
                            borrewedAvarage: ((score + book!.borrewedAvarage) / book!.borrowedCount)
                        }
                    }
                )

                res.send().status(204)
            } catch (error) {
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    if (error.code === 'P2002') {
                        res.status(500).json('There is a unique constraint violation, You cannot borrow already borrowed book.')
                    }
                }
            }
        }

    })

// #endregion


app.listen(process.env.PORT, () => {
    console.log(`Example app listening on port ${process.env.PORT}`)
})