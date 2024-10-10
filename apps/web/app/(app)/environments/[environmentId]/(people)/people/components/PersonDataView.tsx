"use client";

import { getPersonsAction } from "@/app/(app)/environments/[environmentId]/(people)/people/actions";
import { PersonTable } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonTable";
import { debounce } from "lodash";
import { useEffect, useState } from "react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TPersonWithAttributes } from "@formbricks/types/people";

interface PersonDataViewProps {
  environment: TEnvironment;
  itemsPerPage: number;
}

export const PersonDataView = ({ environment, itemsPerPage }: PersonDataViewProps) => {
  const [persons, setPersons] = useState<TPersonWithAttributes[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoaded(false);
      try {
        setHasMore(true);
        const getPersonActionData = await getPersonsAction({
          environmentId: environment.id,
          offset: 0,
          searchValue,
        });
        const personData = getPersonActionData?.data;
        if (getPersonActionData?.data) {
          setPersons(getPersonActionData.data);
        }
        if (personData && personData.length < itemsPerPage) {
          setHasMore(false);
        }
      } catch (error) {
        console.error("Error fetching people data:", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    const debouncedFetchData = debounce(fetchData, 300);
    debouncedFetchData();

    return () => {
      debouncedFetchData.cancel();
    };
  }, [searchValue]);

  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      try {
        const getPersonsActionData = await getPersonsAction({
          environmentId: environment.id,
          offset: persons.length,
          searchValue,
        });
        const personData = getPersonsActionData?.data;
        if (personData) {
          setPersons((prevPersonsData) => [...prevPersonsData, ...personData]);
          if (personData.length === 0 || personData.length < itemsPerPage) {
            setHasMore(false);
          }
        }
      } catch (error) {
        console.error("Error fetching next page of people data:", error);
      } finally {
        setLoadingNextPage(false);
      }
    }
  };

  const deletePersons = (personIds: string[]) => {
    setPersons((prevPersons) => prevPersons.filter((p) => !personIds.includes(p.id)));
  };

  const personTableData = persons.map((person) => ({
    id: person.id,
    userId: person.userId,
    email: person.attributes.email,
    createdAt: person.createdAt,
    attributes: person.attributes,
    personId: person.id,
  }));

  return (
    <PersonTable
      data={personTableData}
      fetchNextPage={fetchNextPage}
      hasMore={hasMore}
      isDataLoaded={isDataLoaded}
      deletePersons={deletePersons}
      environmentId={environment.id}
      searchValue={searchValue}
      setSearchValue={setSearchValue}
    />
  );
};
