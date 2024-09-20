"use client";

import { getPersonsAction } from "@/app/(app)/environments/[environmentId]/(people)/people/actions";
import { PersonTable } from "@/app/(app)/environments/[environmentId]/(people)/people/components/PersonTable";
import { useEffect, useState } from "react";
import React from "react";
import { TEnvironment } from "@formbricks/types/environment";
import { TPersonWithAttributes } from "@formbricks/types/people";

interface PersonDataViewProps {
  environment: TEnvironment;
  personCount: number;
  itemsPerPage: number;
}

export const PersonDataView = ({ environment, personCount, itemsPerPage }: PersonDataViewProps) => {
  const [persons, setPersons] = useState<TPersonWithAttributes[]>([]);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [totalPersons, setTotalPersons] = useState<number>(0);
  const [isDataLoaded, setIsDataLoaded] = useState<boolean>(false);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [loadingNextPage, setLoadingNextPage] = useState<boolean>(false);

  useEffect(() => {
    setTotalPersons(personCount);
    setHasMore(pageNumber < Math.ceil(personCount / itemsPerPage));

    const fetchData = async () => {
      try {
        const getPersonActionData = await getPersonsAction({
          environmentId: environment.id,
          page: pageNumber,
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
  }, [pageNumber, personCount, itemsPerPage, environment.id]);

  const fetchNextPage = async () => {
    if (hasMore && !loadingNextPage) {
      setLoadingNextPage(true);
      const getPersonsActionData = await getPersonsAction({
        environmentId: environment.id,
        page: pageNumber,
      });
      if (getPersonsActionData?.data) {
        const newData = getPersonsActionData.data;
        setPersons((prevPersonsData) => [...prevPersonsData, ...newData]);
      }
      setPageNumber((prevPage) => prevPage + 1);
      setHasMore(pageNumber + 1 < Math.ceil(totalPersons / itemsPerPage));
      setLoadingNextPage(false);
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
    />
  );
};
