using InvoiceApp.Application.Interfaces;

namespace InvoiceApp.Application.Services
{
    public class InvoiceLayoutSchemaProvider : IInvoiceLayoutSchemaProvider
    {
        private const string SchemaJson = @"{
  ""$schema"": ""http://json-schema.org/draft-07/schema#"",
  ""title"": ""InvoiceLayoutConfig"",
  ""type"": ""object"",
  ""required"": [""version"", ""grid"", ""sections""],
  ""properties"": {
    ""version"": { ""type"": ""string"" },
    ""grid"": {
      ""type"": ""object"",
      ""required"": [""columns""],
      ""properties"": {
        ""columns"": { ""type"": ""integer"", ""minimum"": 1, ""maximum"": 24 },
        ""gap"": { ""type"": ""string"" }
      }
    },
    ""sections"": {
      ""type"": ""array"",
      ""items"": {
        ""type"": ""object"",
        ""required"": [""id"", ""type"", ""order"", ""width"", ""position"", ""alignment""],
        ""properties"": {
          ""id"": { ""type"": ""string"" },
          ""type"": {
            ""type"": ""string"",
            ""enum"": [""Header"", ""SellerInfo"", ""BuyerInfo"", ""ItemsTable"", ""Totals"", ""Footer"", ""StaticText""]
          },
          ""order"": { ""type"": ""integer"", ""minimum"": 1 },
          ""width"": { ""type"": ""number"", ""minimum"": 10, ""maximum"": 100 },
          ""position"": { ""type"": ""string"", ""enum"": [""left"", ""center"", ""right""] },
          ""alignment"": { ""type"": ""string"", ""enum"": [""start"", ""center"", ""end""] },
          ""visible"": { ""type"": ""boolean"", ""default"": true },
          ""content"": { ""type"": ""string"" },
          ""styles"": {
            ""type"": ""object"",
            ""properties"": {
              ""padding"": { ""type"": ""string"" },
              ""margin"": { ""type"": ""string"" },
              ""height"": { ""type"": ""string"" },
              ""minHeight"": { ""type"": ""string"" }
            }
          }
        }
      }
    }
  }
}";

        public string GetSchemaJson()
        {
            return SchemaJson;
        }
    }
}
