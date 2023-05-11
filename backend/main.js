const mysql = require('mysql');
//config cors here
const cors = require('cors');
const express = require('express');

const app = express();
const bcrypt = require('bcrypt');

app.use(cors());
app.use(express.json());

const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionStore = new MySQLStore({
    host: 'localhost',
    port: 3306,
    user: 'monica',
    password: 'password',
    database: 'Bookbox'
});

app.use(session({
    secret: 'your-secret-key',
    resave: true,
    saveUninitialized: false,
    store: sessionStore
}));

// MySQL connection
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'monica',
    password: 'password',
    database: 'Bookbox'
});





// Connect to the MySQL database
connection.connect(error => {
    if (error) {
        console.error('Error connecting to MySQL database:', error);
        return;
    }

    console.log('Connected to MySQL database');
});

// Get books endpoint
app.get('/books', (request, response) => {
    response.setHeader('Content-Type', 'application/json');
    connection.query('SELECT id, titlu, autor, pret, stoc FROM Carti', (error, results) => {
        if (error) {
            console.error('Error retrieving book data from MySQL database:', error);
            response.statusCode = 500;
            response.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }

        // Return the book data as JSON
        response.statusCode = 200;
        response.end(JSON.stringify(results));
    });
});

// Login endpoint
app.post('/login', (request, response) => {
    const username = request.body.username;
    const password = request.body.password;


    connection.query('SELECT id, parola, is_admin FROM Utilizatori WHERE username = ?', username, (error, results) => {
        if (error) {
            console.error('Error retrieving user data from MySQL database:', error);
            response.statusCode = 500;
            response.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }
        if (results.length > 0) {
            const user = results[0];
            bcrypt.compare(password, user.parola, (err, result) => {
                if (err) {
                    console.error('Error comparing passwords: ', err);
                }
                else if (result) {
                    request.sessionStore.isAdmin = user.is_admin;
                    request.sessionStore.userId = user.id;
                    response.statusCode = 302;
                    response.setHeader('Location', '/books');
                    response.end();
                }
                else {
                    response.statusCode = 401;
                    response.setHeader('Content-Type', 'application/json');
                    response.end(JSON.stringify({ error: 'Invalid password' }));
                }
            })
        }
        else {
            response.statusCode = 401;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Invalid username or password' }));
        }

    })

});

// Signup endpoint
app.post('/signup', (req, res) => {
    const { username, password, cod } = req.body;

    generatedCode = Math.random().toString().slice(2, 12);

    connection.query('SELECT * FROM Utilizatori WHERE cod = ?', cod, (error, results) => {
        if (error) {
            console.error('Error retrieving user data from MySQL database:', error);
            response.statusCode = 500;
            response.end(JSON.stringify({ error: 'Internal server error' }));
            return;
        }
        if (results.length > 0) {
            bcrypt.hash(password, 10, (err, hash) => {
                if (err) {
                    console.error('Error hashing the password: ', err)
                } else {
                    connection.query('INSERT INTO Utilizatori (username, parola, cod) VALUES (?, ?, ?)', [username, hash, generatedCode], (error, results) => {
                        if (error) {
                            console.error('Error creating user in MySQL database:', error);
                            res.status(500).json({ error: 'Internal server error' });
                            return;
                        }
                        res.status(200).json({ message: 'User created successfully' });
                        connection.query('SELECT id, is_admin FROM Utilizatori WHERE username = ?', username, (err, res) => {
                            if (error) {
                                console.error('Error retreiving user in MySQL database:', error);
                                res.status(500).json({ error: 'Internal server error' });
                                return;
                            }
                            if (res.length > 0) {
                                const user = res[0];
                                req.sessionStore.isAdmin = user.is_admin;
                                req.sessionStore.userId = user.id;

                            }
                        })


                    });
                }
            })

        }
        else {
            response.statusCode = 401;
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify({ error: 'Invalid invite code' }));
        }
    })

});

app.post('/add-books', (req, res) => {
    const titlu = req.body.title;
    const autor = req.body.author;
    const pret = req.body.price;
    const stoc = req.body.stock;
    const sql = `
      INSERT INTO Carti (titlu, autor, pret, stoc)
      VALUES (?, ?, ?, ?)
    `;
    const values = [titlu, autor, pret, stoc];
    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error inserting book into database:', err);
            res.status(500).send('Internal server error');
            return;
        }
        res.status(200).json({ message: 'Book added successfully' });
    });

})


app.post('/orders', (req, res) => {
    const date = new Date();
    const userId = req.sessionStore.userId;
    const totalPrice = req.body.totalCost;
    const booksIds = JSON.stringify(req.body.bookIds);
    const address = req.body.adresa;
    const telephone = req.body.telefon;
    const city = req.body.oras;
    const postalCode = req.body.cod_postal;

    if (date && userId && totalPrice && booksIds !== [] && address !== '' && telephone !== '' && city !== '' && postalCode !== '') {
        const sql = `
      INSERT INTO Comenzi (id_utilizator, data, valoare, iduri_carti, adresa, telefon, oras, cod_postal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
        const values = [userId, date, totalPrice, booksIds, address, telephone, city, postalCode];
        connection.query(sql, values, (err, result) => {
            if (err) {
                console.error('Error inserting order into database:', err);
                res.status(500).send('Internal server error');
                return;
            }
            res.send('Order placed successfully');
        });
    }
    else {
        res.status(404).send('Please fill in all details to place the order!');
    }

});

app.put('/books/:id', (req, res) => {
    const bookId = req.params.id;
    const { title, author, price, stock } = req.body;

    // Update the book in the database
    const sql = 'UPDATE Carti SET titlu = ?, autor = ?, pret = ?, stoc = ? WHERE id = ?';
    connection.query(sql, [title, author, price, stock, bookId], (error, result) => {
        if (error) {
            console.error('Error updating book:', error);
            res.status(500).send('Error updating book');
            return;
        }

        // Get the updated book from the database and send it as the response
        const sql1 = 'SELECT * FROM Carti WHERE id = ?';
        connection.query(sql1, [bookId], (error, result) => {
            if (error) {
                console.error('Error getting updated book:', error);
                res.status(500).send('Error getting updated book');
                return;
            }

            const updatedBook = result[0];
            res.send(updatedBook);
        });
    });
});


app.get('/user-details', (req, res) => {
    if (req.sessionStore.isAdmin === 1) {
        connection.query("SELECT * FROM Utilizatori WHERE is_admin = ?", req.sessionStore.isAdmin, (error, results) => {
            if (error) {
                // Return an error response
                res.status(500).json({ error: 'Internal server error' });
                console.error('Error:', error);
            } else if (results.length === 0) {
                // Return a not found response
                console.error('Error:', error);
                res.status(404).json({ error: 'User not found' });
            } else {
                res.status(302);
                // Return the user's details
                res.json(results[0]);
            }
        });
    }
    else {
        res.status(401).json({ error: 'Unauthorized!' })
    }


}
);

app.delete('/books/:id', (req, res) => {
    const { id } = req.params;
    const sql = `DELETE FROM Carti WHERE id = ${id}`;
    connection.query(sql, (err, result) => {
        if (err) {
            throw err;
        }
        console.log(`Book with ID ${id} deleted.`);
        res.send(`Book with ID ${id} deleted.`);
    });
});


// Start the HTTP server
const port = 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});
