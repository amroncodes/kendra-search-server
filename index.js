const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

// Create an Express app
const app = express();
const port = 3001;
app.use(cors());
app.use(bodyParser.json());

// Initialize the Amazon Kendra client
const kendra = new AWS.Kendra({ region: process.env.AWS_REGION });
const indexId = process.env.INDEX_ID;

// Function to search with Amazon Kendra
async function searchWithKendra(query, indexId) {
    try {
        const response = await kendra.query({
            IndexId: indexId,
            QueryText: query
        }).promise();

        return response.ResultItems;
    } catch (error) {
        console.error('Error searching with Kendra:', error);
        throw error;
    }
}

async function listIndices() {
    // const params = {
    //     "MaxResults": number,
    //     "NextToken": "string"
    //  }
    try {
        const response = await kendra.listIndices().promise();
        console.log(response.IndexConfigurationSummaryItems);
        return response.IndexConfigurationSummaryItems;
    } catch (error) {
        console.error('Error listing indices:', error);
        throw error;
    }
}

async function getResultsHelper(
    queryText,
    pageNumber,
    filter
  ) {

    let results = null;
    console.log("Querying Kendra with query:", queryText);
    const queryRequest = {
      IndexId: indexId,
      QueryText: queryText,
      PageNumber: pageNumber,
      AttributeFilter: filter ? filter : undefined,
    };

    
    if (kendra) {
      try {
        console.log("Initiating query...")
        results = await kendra.query(queryRequest).promise();
      } catch (e) {
        console.error("Error searching with Kendra:", e);
        return;
      }
    } else {
      console.error(
        "WARNING: No Kendra SDK instance provided, using dummy data"
      );
    }

    const tempTopResults = [];
    const tempFAQResults = [];
    const tempDocumentResults = [];
    const tempResults = [];
    let responseData = {
      searchResults: {},
      topResults: tempTopResults,
      faqResults: tempFAQResults,
      docResults: tempDocumentResults,
      dataReady: false,
      error: undefined,
    };
    

    if (results && results.ResultItems) {
      results.ResultItems.forEach((result) => {
        console.log("Result type:", result.Type);
        switch (result.Type) {
          case "ANSWER":
            tempTopResults.push(result);
            break;
          case "QUESTION_ANSWER":
            tempFAQResults.push(result);
            break;
          case "DOCUMENT":
            tempDocumentResults.push(result);
            break;
          default:
            break;
        }
      });
      

      // Only update availableFacets in two situations:
      // 1. There is no filter
      // 2. There is filter and the updateAvailableFacetsWhenFilterChange flag is true
      // if (
      //   !filter ||
      //   (filter &&
      //     this.props.facetConfiguration?.updateAvailableFacetsWhenFilterChange)
      // ) {
      //   this.setState({
      //     availableFacets: AvailableFacetManager.fromQueryResult(results),
      //   });
      // }
     
      // this.setState({
      //   searchResults: results,
      //   topResults: tempTopResults,
      //   faqResults: tempFAQResults,
      //   docResults: tempDocumentResults,
      //   dataReady: true,
      //   error: undefined,
      // });
    } else {
      console.log("No results found!");
      responseData = {
        searchResults: {},
        topResults: tempTopResults,
        faqResults: tempFAQResults,
        docResults: tempDocumentResults,
        dataReady: true,
        error: undefined,
      };
    }
    // this.setState({
    //   currentPageNumber: pageNumber,
    //   queryText: queryText,
    // });

    responseData = {
      searchResults: results,
      topResults: tempTopResults,
      faqResults: tempFAQResults,
      docResults: tempDocumentResults,
      dataReady: true,
      error: undefined,
    };

    console.log("Total results count:", results.ResultItems.length);
    

    return responseData;
  };

async function getResults(queryText, pageNumber = 1) {
    try {
        const response = await kendra.query({
            IndexId: indexId,
            QueryText: queryText,
            PageNumber: pageNumber,
        }).promise();

        if (response && response.ResultItems && Array.isArray(response.ResultItems)) {
            // Extract the data as needed
            const extractedData = response.ResultItems.map(result => ({
                title: result.DocumentTitle?.Text,
                text: result.DocumentExcerpt?.Text
            }));
            console.log(response.ResultItems);
            return extractedData;
        } else {
            console.error('Unexpected response format from Kendra:', response);
            throw new Error('Unexpected response format from Kendra');
        }
    } catch (error) {
        console.error('Error searching with Kendra:', error);
        throw error;
    }
}

app.post('/search', async (req, res) => {
  console.log("Request made!")
  const { QueryText, PageNumber, Facets, SortingConfiguration } = req.body;
  console.log(req.body);
  console.log("Querying Kendra with query:", QueryText);

  // Construct the query request
  // const queryRequest = {
  //     IndexId: 'a60ab929-4f51-4aa3-899d-9fe2128a7b0d',
  //     QueryText: queryText,
  //     PageNumber: pageNumber,
  //     AttributeFilter: selectedFacets,
  //     SortingConfiguration: {
  //         AttributeName: sortingAttribute,
  //         SortOrder: sortingOrder
  //     }
  // };
  const queryRequest = {
    IndexId: indexId,
    QueryText: QueryText,
    PageNumber: PageNumber,
};
  try {
      const results = await kendra.query(queryRequest).promise();
      console.log(`Total results in page ${PageNumber}:`, results.ResultItems.length);
      console.log("Total result count", results.TotalNumberOfResults)
      res.json(results);
  } catch (error) {
      console.error('Error searching with Kendra:', error);
      res.status(500).json({ error: error.message });
    }
  }
);


app.get('/', async (req, res) => {
    console.log("Request made!")
    try {
        // const results = searchWithKendra('What is ec2?', 'c713f2f0-d627-4034-8228-0627c7ac09a8');
        // const results = listIndices();
        const question = 'What is ec2?'
        // const results = getResults(question, 1);
        // const extractedData = await getResults(question, 1);
        const data = await getResultsHelper(question, 1);
        
        console.log(`Displaying results for ${question}:`)
        
        // Loop through the results and extract the DocumentTitle and DocumentExcerpt text and store it in an array
        // const extractedData = results.map(result => ({
        //     title: result.DocumentTitle.Text,
        //     text: result.DocumentExcerpt.Text
        // }));
        // console.log(extractedData);
        res.send(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
    // res.send('Hello World!');
});

app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});

