import pandas as pd
from sqlalchemy import text, inspect
from database import engine

def save_to_warehouse(df: pd.DataFrame, dataset_id: int) -> str:
    table_name = f"cleaned_data_{dataset_id}"
    
    # Write dataframe to SQL (creates table and loads all rows)
    # df.to_sql handles the mapping of types and writes to the DB in chunks
    df.to_sql(
        name=table_name,
        con=engine,
        if_exists="replace",
        index=False,
        chunksize=1000
    )
    
    # Post-creation: Add an index on row_id or key columns for performance if table has columns
    inspector = inspect(engine)
    columns = [col["name"] for col in inspector.get_columns(table_name)]
    
    with engine.connect() as conn:
        # Try to add primary key index dynamically by adding an auto-increment column
        try:
            conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST"))
            conn.commit()
        except Exception:
            # If primary key can't be added, ignore
            pass
            
        # Add index on first 2 columns for general querying optimization
        for col in columns[:3]:
            try:
                # Limit length of indexing if it is a text column
                conn.execute(text(f"CREATE INDEX idx_{col} ON {table_name} ({col}(100))"))
                conn.commit()
            except Exception:
                # If indexing fails (e.g. numeric types don't need length limit), try without length limit
                try:
                    conn.execute(text(f"CREATE INDEX idx_{col} ON {table_name} ({col})"))
                    conn.commit()
                except Exception:
                    pass

    return table_name

def get_from_warehouse(dataset_id: int, limit: int = 100, offset: int = 0) -> pd.DataFrame:
    table_name = f"cleaned_data_{dataset_id}"
    query = f"SELECT * FROM {table_name} LIMIT {limit} OFFSET {offset}"
    return pd.read_sql_query(query, con=engine)

def execute_warehouse_query(dataset_id: int, sql_query: str) -> pd.DataFrame:
    # Ensure query only touches the specified dataset table for security
    table_name = f"cleaned_data_{dataset_id}"
    
    # Simple security sanitization: ensure query only reads and targets this specific table
    sql_clean = sql_query.strip()
    
    # Check if sql contains write commands
    forbidden = ["insert", "update", "delete", "drop", "alter", "create", "truncate", "replace", "grant"]
    if any(cmd in sql_clean.lower() for cmd in forbidden):
        raise ValueError("Only READ (SELECT) queries are allowed for security reasons.")
        
    if table_name not in sql_clean:
        raise ValueError(f"Query must select from the appropriate dataset table: '{table_name}'")

    return pd.read_sql_query(sql_clean, con=engine)
