"use client";

import {
  getPersonCountAction,
  getPersonsAction,
} from "@/app/(app)/environments/[environmentId]/(people)/people/actions";
import { PersonTable } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonTable";
import { useEffect, useState } from "react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TPersonWithAttributes } from "@formbricks/types/people";

interface PersonDataViewProps {
  environment: TEnvironment;
}

export const PersonDataView = ({ environment }: PersonDataViewProps) => {
  const [persons, setPersons] = useState<TPersonWithAttributes[]>([]);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);
  const [searchValue, setSearchValue] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      setIsDataLoaded(false);
      try {
        const getPersonActionData = await getPersonsAction({
          environmentId: environment.id,
          offset: 0,
          search: searchValue,
        });
        if (getPersonActionData?.data) {
          setPersons(getPersonActionData.data);
        }
      } catch (error) {
        console.error("Error fetching people data:", error);
      } finally {
        setIsDataLoaded(true);
      }
    };

    fetchData();
  }, [searchValue]);

  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      const getPersonsActionData = await getPersonsAction({
        environmentId: environment.id,
        offset: persons.length,
        search: searchValue,
      });
      if (getPersonsActionData?.data) {
        const newData = getPersonsActionData.data;
        setPersons((prevPersonsData) => [...prevPersonsData, ...newData]);
      }
      setLoadingNextPage(false);
    }
  };

  const deletePersons = (personIds: string[]) => {
    setPersons((prevPersons) => prevPersons.filter((p) => !personIds.includes(p.id)));
  };

  useEffect(() => {
    const calculateHasMore = async () => {
      const personCount = await getPersonCountAction({
        environmentId: environment.id,
        search: searchValue,
      });
      if (personCount && typeof personCount.data === "number") {
        setHasMore(personCount.data > persons.length);
      }
    };
    calculateHasMore();
  }, [persons.length]);

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
