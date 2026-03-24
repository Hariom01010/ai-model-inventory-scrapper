## AI Inventory Crawler
This is an inventory crawler which takes collection URLs as input and returns whether the products inside it are OOS or in stock.

## Prerequisites
To run the project, you need the following installed on your system:
1. Python
2. Node JS

### How to run it
1. Clone the project
2. Go to model folder
3. Install the dependencies:
```
pip install -r requirements.txt
```
4. Run the following command:
```
python -m uvicorn app.main:app --reload
```
5. Open another terminal and go to root of project directory.
6. Install dependencies:
```
npm i
```
7. Run the node server:
```
node index.js
```

## How to change collections:
Go to constants.js and update the STORE_URL variable and insert your collection urls.